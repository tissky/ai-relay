// ============================================================
// AI API Relay — Provider Types (Unified)
// ============================================================

/**
 * Unified provider configuration.
 * All providers follow this shape — no special cases.
 */
export interface ProviderConfig {
  name: string;                    // 'openai' | 'anthropic' | 'deepseek' | 'xiaomi'
  displayName: string;             // Human-readable name
  baseUrl: string;                 // Default upstream base URL
  modelPrefixes: string[];         // e.g. ['gpt-', 'o1-', 'o3-']
  headerFormat: 'openai' | 'anthropic';  // Auth header format
  envKeyField: string;             // Env var name for API keys
  envBaseUrlField?: string;        // Env var name for custom base URL
}

/**
 * A single API key with metadata.
 */
export interface ApiKey {
  key: string;                     // The raw key
  hash: string;                    // Short hash for KV/logging
  provider: string;                // Provider name
}

/**
 * Key pool for a provider.
 */
export interface KeyPool {
  provider: string;
  keys: ApiKey[];
  counter: number;                 // Round-robin counter
}

/**
 * Relay result — returned from relayRequest().
 */
export interface RelayResult {
  response: Response;
  provider: ProviderConfig;
  apiKey: ApiKey;
}
