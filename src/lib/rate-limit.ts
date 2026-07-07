import { headers } from "next/headers";

// In-process fixed-window rate limiter. Good enough to blunt brute-force and spam
// on a single instance. NOTE: state is per-process — behind multiple replicas each
// gets its own budget, so move this to Redis/Postgres if you scale out horizontally.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Bound the map so a flood of distinct keys can't grow it without limit.
const MAX_KEYS = 50_000;

export type RateResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweepExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

function sweepExpired(now: number): void {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // If sweeping didn't help (all live), drop the oldest-resetting keys.
  if (buckets.size >= MAX_KEYS) {
    const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < sorted.length / 2; i++) buckets.delete(sorted[i][0]);
  }
}

/** Best-effort client IP from proxy headers (Cloudflare / standard forwarding). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
