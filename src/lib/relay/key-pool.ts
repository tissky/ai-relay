// ============================================================
// AI API Relay — Key Pool Management & Rotation
// ============================================================

import type { ApiKey, KeyPool, ProviderConfig } from '../providers/types';

/** In-memory key pools (cold start init, refreshed periodically) */
const keyPools = new Map<string, KeyPool>();

/** Cooldown tracking: key hash → expiry timestamp */
const cooldowns = new Map<string, number>();

const COOLDOWN_MS = 60_000; // 60s cooldown after 429/5xx

/**
 * Hash a key to a short identifier (for KV storage / logging).
 * Uses djb2 — fast, no crypto dependency.
 */
export function hashKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Parse comma-separated API keys from environment variable.
 */
function parseKeys(envValue: string | undefined, provider: string): ApiKey[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map((key) => ({
      key,
      hash: hashKey(key),
      provider,
    }));
}

/**
 * Initialize or refresh key pools from environment variables.
 */
function initKeyPool(config: ProviderConfig): KeyPool {
  const keys = parseKeys(process.env[config.envKeyField], config.name);
  const pool: KeyPool = {
    provider: config.name,
    keys,
    counter: 0,
  };
  keyPools.set(config.name, pool);
  return pool;
}

/**
 * Get the key pool for a provider, initializing if needed.
 */
export function getKeyPool(config: ProviderConfig): KeyPool {
  return keyPools.get(config.name) || initKeyPool(config);
}

/**
 * Select the next available key using round-robin with cooldown skip.
 * Returns null if all keys are on cooldown.
 */
export function selectKey(config: ProviderConfig): ApiKey | null {
  const pool = getKeyPool(config);
  if (pool.keys.length === 0) return null;

  const now = Date.now();
  const totalKeys = pool.keys.length;

  for (let i = 0; i < totalKeys; i++) {
    const idx = (pool.counter + i) % totalKeys;
    const candidate = pool.keys[idx];
    const cooldownUntil = cooldowns.get(candidate.hash);

    if (!cooldownUntil || now >= cooldownUntil) {
      pool.counter = (idx + 1) % totalKeys;
      return candidate;
    }
  }

  // All keys on cooldown — return the one with earliest expiry
  let earliest = pool.keys[0];
  let earliestTime = cooldowns.get(earliest.hash) || Infinity;
  for (const key of pool.keys) {
    const cd = cooldowns.get(key.hash) || Infinity;
    if (cd < earliestTime) {
      earliest = key;
      earliestTime = cd;
    }
  }
  pool.counter = (pool.keys.indexOf(earliest) + 1) % totalKeys;
  return earliest;
}

/**
 * Mark a key as on cooldown (called after 429 or 5xx).
 */
export function markCooldown(key: ApiKey): void {
  cooldowns.set(key.hash, Date.now() + COOLDOWN_MS);
}

/**
 * Get key pool stats for admin/status page.
 */
export function getKeyPoolStats(): Record<string, { total: number; available: number }> {
  const now = Date.now();
  const stats: Record<string, { total: number; available: number }> = {};

  for (const [name, pool] of keyPools) {
    const available = pool.keys.filter(
      (k) => !cooldowns.has(k.hash) || now >= cooldowns.get(k.hash)!
    ).length;
    stats[name] = { total: pool.keys.length, available };
  }

  return stats;
}
