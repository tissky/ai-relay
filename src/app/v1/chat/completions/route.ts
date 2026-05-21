// ============================================================
// AI API Relay — /v1/chat/completions Route Handler
// ============================================================

import { NextRequest } from 'next/server';
import { validateAuth, relayRequest } from '@/lib/relay';
import { RelayError } from '@/lib/errors';
import { KVUsageStorage } from '@/lib/usage';

export const runtime = 'edge';

const usageStorage = new KVUsageStorage();

/**
 * POST /v1/chat/completions
 *
 * OpenAI-compatible chat completions endpoint.
 * Routes requests to the appropriate upstream provider based on model prefix.
 */
export async function POST(request: NextRequest) {
  // 1. Validate authentication
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

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Invalid JSON in request body.',
          type: 'invalid_request_error',
          code: 400,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Validate required fields
  if (!body.model) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Missing required field: model.',
          type: 'invalid_request_error',
          code: 400,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Missing or empty required field: messages.',
          type: 'invalid_request_error',
          code: 400,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3.5. Check rate limits (quota)
  const quota = await usageStorage.checkQuota();
  if (!quota.allowed) {
    return new Response(
      JSON.stringify({
        error: {
          message: `Rate limit exceeded. Daily: ${quota.dailyUsed}/${quota.dailyLimit}, Monthly: ${quota.monthlyUsed}/${quota.monthlyLimit}. Retry after ${quota.retryAfter}s.`,
          type: 'rate_limit_error',
          code: 429,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(quota.retryAfter || 60),
        },
      }
    );
  }

  // 4. Relay the request
  try {
    const { response, provider, apiKey } = await relayRequest(body);

    // 5. Stream or return the response
    if (body.stream) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Relay-Provider': provider.name,
          'X-Relay-Key': apiKey.hash,
        },
      });
    } else {
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Provider': provider.name,
          'X-Relay-Key': apiKey.hash,
        },
      });
    }
  } catch (error) {
    if (error instanceof RelayError) {
      return error.toResponse();
    }

    console.error('Relay error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: 'Internal relay error.',
          type: 'server_error',
          code: 500,
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
