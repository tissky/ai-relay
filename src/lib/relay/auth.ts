// ============================================================
// AI API Relay — Auth Validation
// ============================================================

/**
 * Validate the relay API key from the Authorization header.
 * Returns true if valid, false otherwise.
 */
export function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const validKeys = getRelayApiKeys();

  return validKeys.includes(token);
}

/**
 * Get all configured relay API keys.
 */
export function getRelayApiKeys(): string[] {
  return (process.env.RELAY_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Validate auth and return error response if invalid.
 * Returns null if auth is valid.
 */
export function requireAuth(request: Request): Response | null {
  if (!validateAuth(request)) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Invalid API key. Provide a valid key in the Authorization header.',
          type: 'authentication_error',
          code: 401,
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
