import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { RateLimiterService } from '../rateLimiter.service.js';
import { getRedisClient } from '../../redis.js';

describe('RateLimiterService (Atomic Sliding Window with Redis Lua)', () => {
  const service = new RateLimiterService();
  const testPrefix = 'seekr:ratelimit:test';

  beforeEach(async () => {
    await service.clearPattern(`${testPrefix}:*`);
  });

  afterAll(async () => {
    await service.clearPattern(`${testPrefix}:*`);
  });

  it('allows requests within limit and correctly decrements remaining quota', async () => {
    const key = `${testPrefix}:user1`;
    const limit = 5;
    const windowMs = 60000;

    for (let i = 0; i < limit; i++) {
      const res = await service.consume(key, limit, windowMs);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(limit);
      expect(res.remaining).toBe(limit - 1 - i);
      expect(res.retryAfter).toBe(0);
      expect(res.resetTime).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it('blocks requests once limit is reached and returns positive retryAfter', async () => {
    const key = `${testPrefix}:user2`;
    const limit = 3;
    const windowMs = 5000;

    // Consume all 3
    await service.consume(key, limit, windowMs);
    await service.consume(key, limit, windowMs);
    const lastAllowed = await service.consume(key, limit, windowMs);
    expect(lastAllowed.allowed).toBe(true);
    expect(lastAllowed.remaining).toBe(0);

    // 4th request must be rejected
    const blocked = await service.consume(key, limit, windowMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfter).toBeLessThanOrEqual(5);
  });

  it('slides the window and permits new requests as timestamps age out', async () => {
    const key = `${testPrefix}:user3`;
    const limit = 2;
    const windowMs = 300; // 300ms window

    // Consume 2 requests
    const r1 = await service.consume(key, limit, windowMs);
    const r2 = await service.consume(key, limit, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);

    // 3rd request blocked
    const r3 = await service.consume(key, limit, windowMs);
    expect(r3.allowed).toBe(false);

    // Sleep for windowMs + 50ms
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Now previous requests have slid out of the window
    const r4 = await service.consume(key, limit, windowMs);
    expect(r4.allowed).toBe(true);
    expect(r4.remaining).toBe(1);
  });

  it('resets quota when reset() is invoked', async () => {
    const key = `${testPrefix}:user4`;
    const limit = 2;
    const windowMs = 60000;

    await service.consume(key, limit, windowMs);
    await service.consume(key, limit, windowMs);
    const blocked = await service.consume(key, limit, windowMs);
    expect(blocked.allowed).toBe(false);

    // Administrative or test reset
    await service.reset(key);

    const afterReset = await service.consume(key, limit, windowMs);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it('fails open when Redis errors occur so service traffic is not dropped', async () => {
    const brokenRedis = {
      eval: vi.fn().mockRejectedValue(new Error('Connection timed out')),
    } as any;

    const resilientService = new RateLimiterService(brokenRedis);
    const res = await resilientService.consume('some:key', 10, 60000);

    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(10);
    expect(res.remaining).toBe(9);
    expect(res.retryAfter).toBe(0);
  });
});
