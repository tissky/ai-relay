// ============================================================
// AI API Relay — CF Bindings Helper
// ============================================================
// Provides access to Cloudflare KV and D1 bindings when running
// on Cloudflare Pages. Returns null outside CF environment.
//
// Uses getRequestContext() from @cloudflare/next-on-pages so that
// bindings are always request-scoped — no module-level state, no
// race conditions between concurrent requests.

export interface CFEnv {
  KV: import('@cloudflare/workers-types').KVNamespace;
  DB: import('@cloudflare/workers-types').D1Database;
}

export function getCFEnv(): CFEnv | null {
  if (!process.env.CF_PAGES) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    return ctx.env as unknown as CFEnv;
  } catch {
    return null;
  }
}

export function isCloudflare(): boolean {
  return !!process.env.CF_PAGES;
}
