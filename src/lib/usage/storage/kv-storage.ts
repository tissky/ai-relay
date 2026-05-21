// ============================================================
// AI API Relay — KV-backed Usage Storage (Vercel KV)
// ============================================================

import type {
  UsageStorage,
  UsageEvent,
  TrendPoint,
  ProviderTrendPoint,
  QuotaStatus,
} from '../sdk';

/** Known provider names for trend queries */
const PROVIDER_NAMES = ['openai', 'anthropic', 'deepseek', 'xiaomi'];

/**
 * Get today's date string in YYYY-MM-DD format.
 */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function dateRange(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthLabel(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function aggregatePoints(points: TrendPoint[], labelFn: (date: string) => string): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  for (const p of points) {
    const label = labelFn(p.date);
    const existing = buckets.get(label);
    if (existing) {
      existing.requests += p.requests;
      existing.promptTokens += p.promptTokens;
      existing.completionTokens += p.completionTokens;
      existing.totalTokens += p.totalTokens;
    } else {
      buckets.set(label, {
        date: label,
        requests: p.requests,
        promptTokens: p.promptTokens,
        completionTokens: p.completionTokens,
        totalTokens: p.totalTokens,
      });
    }
  }
  return Array.from(buckets.values());
}

function parseDailyPoint(date: string, raw: Record<string, unknown> | null): TrendPoint {
  return {
    date,
    requests: Number(raw?.requests || 0),
    promptTokens: Number(raw?.promptTokens || 0),
    completionTokens: Number(raw?.completionTokens || 0),
    totalTokens: Number(raw?.tokens || 0),
  };
}

/**
 * Lazy KV client loader.
 * Returns null if KV is not configured.
 */
async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

/**
 * KV-backed implementation of UsageStorage.
 */
export class KVUsageStorage implements UsageStorage {
  async record(event: UsageEvent): Promise<void> {
    try {
      const kv = await getKV();
      if (!kv) return;

      const date = today();
      const totalTokens = event.totalTokens;

      // Per-key daily usage
      const keyDailyKey = `usage:${event.apiKeyHash}:daily:${date}`;
      await kv.hincrby(keyDailyKey, 'requests', 1);
      await kv.hincrby(keyDailyKey, 'tokens', totalTokens);
      await kv.expire(keyDailyKey, 86400 * 7);

      // Per-key total usage
      const keyTotalKey = `usage:${event.apiKeyHash}:total`;
      await kv.hincrby(keyTotalKey, 'requests', 1);
      await kv.hincrby(keyTotalKey, 'tokens', totalTokens);

      // Global daily usage (with prompt/completion split)
      const globalDailyKey = `usage:daily:${date}`;
      await kv.hincrby(globalDailyKey, 'requests', 1);
      await kv.hincrby(globalDailyKey, 'tokens', totalTokens);
      await kv.hincrby(globalDailyKey, 'promptTokens', event.promptTokens);
      await kv.hincrby(globalDailyKey, 'completionTokens', event.completionTokens);
      await kv.expire(globalDailyKey, 86400 * 30);

      // Per-provider daily usage
      if (event.provider) {
        const providerDailyKey = `usage:provider:${event.provider}:daily:${date}`;
        await kv.hincrby(providerDailyKey, 'requests', 1);
        await kv.hincrby(providerDailyKey, 'tokens', totalTokens);
        await kv.hincrby(providerDailyKey, 'promptTokens', event.promptTokens);
        await kv.hincrby(providerDailyKey, 'completionTokens', event.completionTokens);
        await kv.expire(providerDailyKey, 86400 * 30);
      }

      // Increment quota counters
      await this.incrementQuota(kv);
    } catch {
      // Non-critical — never break the request
    }
  }

  async getKeyUsage(keyHash: string): Promise<{
    daily: { requests: number; tokens: number };
    total: { requests: number; tokens: number };
  } | null> {
    try {
      const kv = await getKV();
      if (!kv) return null;

      const date = today();
      const dailyRaw = await kv.hgetall(`usage:${keyHash}:daily:${date}`);
      const totalRaw = await kv.hgetall(`usage:${keyHash}:total`);

      return {
        daily: {
          requests: Number(dailyRaw?.requests || 0),
          tokens: Number(dailyRaw?.tokens || 0),
        },
        total: {
          requests: Number(totalRaw?.requests || 0),
          tokens: Number(totalRaw?.tokens || 0),
        },
      };
    } catch {
      return null;
    }
  }

  async getGlobalUsage(): Promise<{ requests: number; tokens: number } | null> {
    try {
      const kv = await getKV();
      if (!kv) return null;

      const date = today();
      const raw = await kv.hgetall(`usage:daily:${date}`);
      return {
        requests: Number(raw?.requests || 0),
        tokens: Number(raw?.tokens || 0),
      };
    } catch {
      return null;
    }
  }

  async getUsageTrend(
    range: string,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<{ global: TrendPoint[]; providers: ProviderTrendPoint[] }> {
    const kv = await getKV();
    if (!kv) {
      return { global: [], providers: [] };
    }

    let days: number;
    if (granularity === 'day') {
      days = range === '30d' ? 30 : 7;
    } else if (granularity === 'week') {
      days = range === '12w' ? 84 : 28;
    } else {
      days = range === '12m' ? 365 : 180;
    }

    const dates = dateRange(days);

    const globalPromises = dates.map(async (date) => {
      const raw = await kv.hgetall(`usage:daily:${date}`);
      return parseDailyPoint(date, raw as Record<string, unknown> | null);
    });

    const providerPromises = PROVIDER_NAMES.map(async (provider) => {
      const dataPromises = dates.map(async (date) => {
        const raw = await kv.hgetall(`usage:provider:${provider}:daily:${date}`);
        return parseDailyPoint(date, raw as Record<string, unknown> | null);
      });
      const data = await Promise.all(dataPromises);
      return { provider, data };
    });

    const [globalDaily, providersDaily] = await Promise.all([
      Promise.all(globalPromises),
      Promise.all(providerPromises),
    ]);

    if (granularity === 'day') {
      const activeProviders = providersDaily.filter((p) =>
        p.data.some((d) => d.totalTokens > 0)
      );
      return { global: globalDaily, providers: activeProviders };
    }

    const labelFn = granularity === 'week' ? getWeekLabel : getMonthLabel;
    const global = aggregatePoints(globalDaily, labelFn);
    const providers = providersDaily
      .map((p) => ({
        provider: p.provider,
        data: aggregatePoints(p.data, labelFn),
      }))
      .filter((p) => p.data.some((d) => d.totalTokens > 0));

    return { global, providers };
  }

  async checkQuota(): Promise<QuotaStatus> {
    const dailyLimit = parseInt(process.env.RELAY_DAILY_LIMIT || '0', 10) || 0;
    const monthlyLimit = parseInt(process.env.RELAY_MONTHLY_LIMIT || '0', 10) || 0;
    const kv = await getKV();

    if (!kv || (!dailyLimit && !monthlyLimit)) {
      return { allowed: true, dailyUsed: 0, dailyLimit, monthlyUsed: 0, monthlyLimit };
    }

    const date = today();
    const month = thisMonth();

    const [dailyUsed, monthlyUsed] = await Promise.all([
      kv.get<number>(`quota:daily:${date}`).then((v) => v || 0),
      kv.get<number>(`quota:monthly:${month}`).then((v) => v || 0),
    ]);

    if (dailyLimit > 0 && dailyUsed >= dailyLimit) {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const retryAfter = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
      return { allowed: false, dailyUsed, dailyLimit, monthlyUsed, monthlyLimit, retryAfter };
    }

    if (monthlyLimit > 0 && monthlyUsed >= monthlyLimit) {
      const now = new Date();
      const nextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
      const retryAfter = Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
      return { allowed: false, dailyUsed, dailyLimit, monthlyUsed, monthlyLimit, retryAfter };
    }

    return { allowed: true, dailyUsed, dailyLimit, monthlyUsed, monthlyLimit };
  }

  private async incrementQuota(kv: Awaited<ReturnType<typeof getKV>>): Promise<void> {
    if (!kv) return;
    try {
      const date = today();
      const month = thisMonth();
      const dailyKey = `quota:daily:${date}`;
      const monthlyKey = `quota:monthly:${month}`;
      await Promise.all([
        kv.incr(dailyKey).then(() => kv.expire(dailyKey, 86400 * 2)),
        kv.incr(monthlyKey).then(() => kv.expire(monthlyKey, 86400 * 35)),
      ]);
    } catch {
      // Non-critical
    }
  }
}
