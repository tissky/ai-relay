// ============================================================
// AI API Relay — Admin API (/api/admin)
// ============================================================

import { NextRequest } from 'next/server';
import { getKeyPoolStats, getRelayApiKeys } from '@/lib/relay';
import { KVUsageStorage } from '@/lib/usage';
import { PROVIDERS } from '@/lib/providers';

export const runtime = 'edge';

const usageStorage = new KVUsageStorage();

/**
 * GET /api/admin
 *
 * Returns comprehensive admin data:
 * - Provider key pool status
 * - Global usage stats
 * - Quota status
 * - Model aliases
 */
export async function GET(request: NextRequest) {
  // Auth check — require RELAY_API_KEY
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || '';
  const validKeys = getRelayApiKeys();

  if (!token || !validKeys.includes(token)) {
    return Response.json(
      { error: { message: 'Unauthorized. Use Bearer token.', code: 401 } },
      { status: 401 }
    );
  }

  const providerStats = getKeyPoolStats();
  const globalUsage = await usageStorage.getGlobalUsage();
  const quota = await usageStorage.checkQuota();

  const providers = Object.entries(PROVIDERS).map(([name, config]) => {
    const stats = providerStats[name];
    return {
      name: config.displayName,
      id: name,
      keyCount: stats?.total || 0,
      availableKeys: stats?.available || 0,
      configured: !!process.env[config.envKeyField],
      modelPrefixes: config.modelPrefixes,
    };
  });

  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers,
    usage: globalUsage || { requests: 0, tokens: 0 },
    quota: {
      daily: { used: quota.dailyUsed, limit: quota.dailyLimit || 'unlimited' },
      monthly: { used: quota.monthlyUsed, limit: quota.monthlyLimit || 'unlimited' },
      allowed: quota.allowed,
    },
    config: {
      dailyLimit: parseInt(process.env.RELAY_DAILY_LIMIT || '0', 10) || null,
      monthlyLimit: parseInt(process.env.RELAY_MONTHLY_LIMIT || '0', 10) || null,
    },
  });
}
