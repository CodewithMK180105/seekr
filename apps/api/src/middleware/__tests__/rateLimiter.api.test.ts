import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { app } from '../../app.js';
import { errorHandler } from '../errorHandler.js';
import {
  createRateLimiter,
  searchRateLimiter,
  researchRateLimiter,
  suggestionsRateLimiter,
  globalApiRateLimiter,
} from '../rateLimiter.js';
import { RateLimiterService } from '@seekr/shared';

describe('API Rate Limiting & Quota Management (Milestone 6.2)', () => {
  const rateLimiterService = new RateLimiterService();

  beforeEach(async () => {
    // Clear test keys before each test
    await rateLimiterService.clearPattern('seekr:ratelimit:*');
  });

  afterAll(async () => {
    // Clean up
    await rateLimiterService.clearPattern('seekr:ratelimit:*');
  });

  describe('Standard RFC Headers & Response Envelopes', () => {
    it('attaches RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset headers to responses', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=test')
        .set('x-forwarded-for', '203.0.113.1');

      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
      expect(res.headers).toHaveProperty('ratelimit-reset');

      expect(Number(res.headers['ratelimit-limit'])).toBe(60); // Anonymous search quota
      expect(Number(res.headers['ratelimit-remaining'])).toBe(59);
    });

    it('grants higher authenticated quota tier when API key or Bearer token is provided', async () => {
      // Anonymous request
      const anonRes = await request(app)
        .get('/api/v1/search?q=test')
        .set('x-forwarded-for', '203.0.113.2');
      expect(Number(anonRes.headers['ratelimit-limit'])).toBe(60);

      // Authenticated with API key
      const authRes = await request(app)
        .get('/api/v1/search?q=test')
        .set('x-api-key', 'seekr-secret-api-key-test')
        .set('x-forwarded-for', '203.0.113.2');
      expect(Number(authRes.headers['ratelimit-limit'])).toBe(180); // Authenticated search quota
      expect(Number(authRes.headers['ratelimit-remaining'])).toBe(179);

      // Authenticated with Bearer token
      const bearerRes = await request(app)
        .get('/api/v1/search?q=test')
        .set('Authorization', 'Bearer dummy-jwt-token-12345')
        .set('x-forwarded-for', '203.0.113.2');
      expect(Number(bearerRes.headers['ratelimit-limit'])).toBe(180);
      expect(Number(bearerRes.headers['ratelimit-remaining'])).toBe(179);
    });

    it('differentiates quotas across endpoint tiers (search, research, suggestions, global)', async () => {
      const ip = '203.0.113.10';

      const searchRes = await request(app)
        .get('/api/v1/search?q=test')
        .set('x-forwarded-for', ip);
      expect(Number(searchRes.headers['ratelimit-limit'])).toBe(60);

      const suggestionsRes = await request(app)
        .get('/api/v1/search/suggestions?q=te')
        .set('x-forwarded-for', ip);
      expect(Number(suggestionsRes.headers['ratelimit-limit'])).toBe(120);

      const cacheStatsRes = await request(app)
        .get('/api/v1/cache/stats')
        .set('x-forwarded-for', ip);
      expect(Number(cacheStatsRes.headers['ratelimit-limit'])).toBe(120); // Global fallback
    });

    it('bypasses system health check endpoints', async () => {
      const healthRes = await request(app).get('/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.headers['ratelimit-limit']).toBeUndefined();

      const readyRes = await request(app).get('/ready');
      expect(readyRes.status).toBe(200);
      expect(readyRes.headers['ratelimit-limit']).toBeUndefined();
    });
  });

  describe('Rate Limit Exceeded Enforcement (HTTP 429)', () => {
    it('enforces limit and returns 429 with Retry-After and standard error envelope', async () => {
      const miniApp: Express = express();
      miniApp.use(express.json());
      miniApp.use((req, res, next) => {
        req.headers['x-request-id'] = 'test-request-id';
        next();
      });
      const testLimiter = createRateLimiter(
        {
          prefix: 'test-limit',
          windowMs: 5000,
          anonymousLimit: 2,
          authenticatedLimit: 5,
        },
        rateLimiterService
      );

      miniApp.get('/test', testLimiter, (_req, res) => {
        res.json({ success: true });
      });
      miniApp.use(errorHandler);

      const clientIp = '198.51.100.99';

      // 1st request -> OK
      const res1 = await request(miniApp)
        .get('/test')
        .set('x-forwarded-for', clientIp);
      expect(res1.status).toBe(200);
      expect(res1.headers['ratelimit-remaining']).toBe('1');

      // 2nd request -> OK
      const res2 = await request(miniApp)
        .get('/test')
        .set('x-forwarded-for', clientIp);
      expect(res2.status).toBe(200);
      expect(res2.headers['ratelimit-remaining']).toBe('0');

      // 3rd request -> 429 Too Many Requests
      const res3 = await request(miniApp)
        .get('/test')
        .set('x-forwarded-for', clientIp);

      expect(res3.status).toBe(429);
      expect(res3.headers['ratelimit-remaining']).toBe('0');
      expect(res3.headers).toHaveProperty('retry-after');
      expect(Number(res3.headers['retry-after'])).toBeGreaterThanOrEqual(1);

      expect(res3.body).toEqual({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: expect.stringContaining('Rate limit exceeded for test-limit'),
          retryAfter: expect.any(Number),
        },
        meta: {
          requestId: expect.any(String),
        },
      });
    });

    it('maintains independent rate limit counters for distinct clients and tiers', async () => {
      const miniApp: Express = express();
      const testLimiter = createRateLimiter(
        {
          prefix: 'test-multi',
          windowMs: 10000,
          anonymousLimit: 1,
          authenticatedLimit: 2,
        },
        rateLimiterService
      );
      miniApp.get('/test', testLimiter, (_req, res) => res.json({ ok: true }));
      miniApp.use(errorHandler);

      // Client A exhausts quota
      const clientA = '192.0.2.1';
      const a1 = await request(miniApp).get('/test').set('x-forwarded-for', clientA);
      expect(a1.status).toBe(200);
      const a2 = await request(miniApp).get('/test').set('x-forwarded-for', clientA);
      expect(a2.status).toBe(429);

      // Client B is unaffected
      const clientB = '192.0.2.2';
      const b1 = await request(miniApp).get('/test').set('x-forwarded-for', clientB);
      expect(b1.status).toBe(200);

      // Authenticated Client with Client A's IP still gets their separate authenticated quota
      const authA1 = await request(miniApp)
        .get('/test')
        .set('x-forwarded-for', clientA)
        .set('x-api-key', 'user-token-abc');
      expect(authA1.status).toBe(200);
      expect(authA1.headers['ratelimit-remaining']).toBe('1');
    });
  });
});
