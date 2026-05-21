// ============================================================
// AI API Relay — Drizzle ORM Client (Postgres)
// ============================================================

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Lazy-initialized Postgres client.
 * Only connects when DATABASE_URL is set.
 * Uses postgres.js (lightweight, serverless-friendly).
 */

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: postgres.Sql | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Drizzle ORM requires a Postgres connection string.'
    );
  }

  _client = postgres(url, {
    max: 5,                    // small pool for serverless
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,            // required for Supabase/PgBouncer
  });

  _db = drizzle(_client, { schema });
  return _db;
}

/**
 * Check if database is available (env var set).
 */
export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Get database if available, null otherwise.
 * Useful for graceful degradation.
 */
export function getDbOrNull() {
  if (!hasDb()) return null;
  try {
    return getDb();
  } catch {
    return null;
  }
}

/**
 * Close the database connection (for graceful shutdown).
 */
export async function closeDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}
