// ============================================================
// AI API Relay — Request Transformation
// ============================================================

import type { ChatCompletionRequest } from '../types';

/**
 * Transform OpenAI-format request to Anthropic format.
 */
export function transformToAnthropic(body: ChatCompletionRequest): Record<string, unknown> {
  const { messages, model, max_tokens, temperature, top_p, stream, stop } = body;

  // Extract system message
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

  const anthropicBody: Record<string, unknown> = {
    model,
    max_tokens: max_tokens || 4096,
    messages: nonSystemMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    })),
  };

  if (systemMsg?.content) {
    anthropicBody.system = systemMsg.content;
  }
  if (temperature !== undefined) anthropicBody.temperature = temperature;
  if (top_p !== undefined) anthropicBody.top_p = top_p;
  if (stream !== undefined) anthropicBody.stream = stream;
  if (stop) anthropicBody.stop_sequences = Array.isArray(stop) ? stop : [stop];

  return anthropicBody;
}

/**
 * Build upstream request headers based on provider format.
 */
export function buildHeaders(
  headerFormat: 'openai' | 'anthropic',
  apiKey: string,
  isStream: boolean
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (headerFormat === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (isStream) {
    headers['Accept'] = 'text/event-stream';
  }

  return headers;
}
