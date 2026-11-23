import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { getRedisClient } from '../redis.js';
import { RateLimitResult } from '@seekr/types';

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local nonce = ARGV[4]

local clearBefore = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local currentRequests = redis.call('ZCARD', key)

if currentRequests < maxRequests then
    redis.call('ZADD', key, now, nonce)
    redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 2)
    local remaining = maxRequests - currentRequests - 1
    local resetTime = math.ceil((now + windowMs) / 1000)
    return { 1, remaining, resetTime, 0 }
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldestScore = tonumber(oldest[2])
    local retryAfter = 1
    local resetTime = math.ceil((now + windowMs) / 1000)
    if oldestScore then
        retryAfter = math.ceil((oldestScore + windowMs - now) / 1000)
        resetTime = math.ceil((oldestScore + windowMs) / 1000)
    end
    if retryAfter < 1 then retryAfter = 1 end
    return { 0, 0, resetTime, retryAfter }
end
`;

export class RateLimiterService {
  private redis: Redis;

  constructor(redisClient?: Redis) {
    this.redis = redisClient ?? getRedisClient();
  }

  /**
   * Consumes a single token from the sliding window for the given key.
   * Atomic execution via Redis Lua script ensures zero race conditions.
   */
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const nonce = `${now}:${randomBytes(4).toString('hex')}`;

    try {
      const result = (await this.redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        now,
        windowMs,
        limit,
        nonce
      )) as [number, number, number, number];

      const [allowedRaw, remaining, resetTime, retryAfter] = result;
      const allowed = allowedRaw === 1;

      return {
        allowed,
        limit,
        remaining,
        resetTime,
        retryAfter,
      };
    } catch (err) {
      // Fail open if Redis is temporarily unreachable so critical user traffic isn't dropped
      console.warn('[RateLimiterService] Redis error during rate limit check, failing open:', err);
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetTime: Math.ceil((now + windowMs) / 1000),
        retryAfter: 0,
      };
    }
  }

  /**
   * Resets rate limit quota for a key (useful for tests and administrative resets).
   */
  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      console.warn('[RateLimiterService] Failed to reset key:', err);
    }
  }

  /**
   * Clears all keys matching a prefix.
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deleted = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          const count = await this.redis.del(...keys);
          deleted += count;
        }
      } while (cursor !== '0');
      return deleted;
    } catch (err) {
      console.warn('[RateLimiterService] Failed to clear pattern:', err);
      return 0;
    }
  }
}
