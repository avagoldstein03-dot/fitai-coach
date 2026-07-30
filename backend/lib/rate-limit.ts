import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, requests: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!redis) return null;
  const cached = limiters.get(name);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `ratelimit:${name}`,
  });
  limiters.set(name, limiter);
  return limiter;
}

/**
 * Returns true if the request should be allowed, false if it's over the limit.
 * Fails open (allows the request) if Upstash isn't configured, so local dev
 * without Redis credentials still works.
 */
export async function checkRateLimit(
  name: string,
  key: string,
  requests: number,
  window: `${number} ${"s" | "m" | "h"}`
): Promise<boolean> {
  const limiter = getLimiter(name, requests, window);
  if (!limiter) return true;
  const { success } = await limiter.limit(key);
  return success;
}
