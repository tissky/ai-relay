// ============================================================
// AI API Relay — Provider Resolver
// ============================================================

import type { ProviderConfig } from './types';
import { PROVIDERS } from './registry';

/**
 * Model alias mapping — lets users request common names that get
 * transparently rewritten to the actual upstream model ID.
 */
const MODEL_ALIASES: Record<string, string> = {
  'gpt-4': 'gpt-4-turbo',
  'gpt-3.5': 'gpt-3.5-turbo',
  'claude-3': 'claude-3-5-sonnet-20241022',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-haiku': 'claude-3-5-haiku-20241022',
};

/**
 * Resolve a model alias to its actual model name.
 * Returns the original name if no alias exists.
 */
export function resolveModelAlias(model: string): string {
  return MODEL_ALIASES[model.toLowerCase()] || model;
}

/**
 * Resolve which provider a model name belongs to.
 * Automatically resolves aliases before matching.
 * Returns null if no provider matches.
 */
export function resolveProvider(model: string): ProviderConfig | null {
  const resolved = resolveModelAlias(model);
  const lowerModel = resolved.toLowerCase();
  for (const provider of Object.values(PROVIDERS)) {
    for (const prefix of provider.modelPrefixes) {
      if (lowerModel.startsWith(prefix)) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Get the upstream URL for a provider's chat completions endpoint.
 */
export function getUpstreamUrl(provider: ProviderConfig): string {
  const customBase = provider.envBaseUrlField
    ? process.env[provider.envBaseUrlField]
    : undefined;
  const base = customBase || provider.baseUrl;

  if (provider.headerFormat === 'anthropic') {
    return `${base}/messages`;
  }
  return `${base}/chat/completions`;
}
