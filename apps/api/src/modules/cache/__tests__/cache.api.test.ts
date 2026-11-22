import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { registerLlmProvider, resetLlmProvider, MockLlmProvider, RedisCacheService, prisma } from '@seekr/shared';
import { SemanticCacheService } from '../semantic-cache.service.js';

describe('Cache Management & Pipeline Caching API Integration Tests', () => {
  const redisCache = new RedisCacheService();
  const semanticCache = new SemanticCacheService(redisCache);

  beforeAll(async () => {
    const mockProvider = new MockLlmProvider({
      defaultReply:
        'Redis achieves durability using Append-Only File (AOF) persistence [1] and point-in-time snapshotting [2].',
      latencyMs: 1,
    });
    registerLlmProvider('gemini', mockProvider);

    await semanticCache.invalidate();
    await redisCache.clearAllExact();
    await redisCache.resetStats();
  });

  afterAll(async () => {
    resetLlmProvider();
    await semanticCache.invalidate();
    await redisCache.clearAllExact();
    await redisCache.resetStats();
  });

  describe('Cache Management Endpoints', () => {
    it('GET /api/v1/cache/stats returns cache statistics with initial values', async () => {
      const res = await request(app).get('/api/v1/cache/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('exactHitCount');
      expect(res.body.data).toHaveProperty('semanticHitCount');
      expect(res.body.data).toHaveProperty('missCount');
      expect(res.body.data).toHaveProperty('totalHitRatio');
    });

    it('POST /api/v1/cache/clear invalidates cache and returns deleted counts', async () => {
      // Seed an entry
      await semanticCache.store({
        cacheType: 'SEARCH',
        query: 'test query',
        payload: { results: [] },
      });

      const res = await request(app)
        .post('/api/v1/cache/clear')
        .send({ cacheType: 'SEARCH' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cleared).toBe(true);
      expect(res.body.data.semanticDeleted).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/cache/cleanup executes without error', async () => {
      const res = await request(app).post('/api/v1/cache/cleanup');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cleaned).toBe(true);
      expect(typeof res.body.data.deletedCount).toBe('number');
    });
  });

  describe('Search Pipeline Caching Integration', () => {
    it('caches search results on first call and serves from cache on second call', async () => {
      const query = 'redis caching and persistence';

      // 1. First search call: Fresh execution
      const res1 = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(query)}&mode=HYBRID`)
        .expect(200);

      expect(res1.body.success).toBe(true);
      // Fresh call is not served from cache
      expect(res1.body.data.cached).toBeUndefined();

      // Give async cache write a moment to persist
      await new Promise((r) => setTimeout(r, 100));

      // 2. Second search call: Served from exact cache (L1)
      const res2 = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(query)}&mode=HYBRID`)
        .expect(200);

      expect(res2.body.success).toBe(true);
      expect(res2.body.data.cached).toBe(true);
      expect(res2.body.data.cacheType).toBe('EXACT');
      expect(res2.body.data.results.length).toBe(res1.body.data.results.length);
    });

    it('bypasses search cache when skipCache=true query parameter is passed', async () => {
      const query = 'redis caching and persistence';

      const res = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(query)}&mode=HYBRID&skipCache=true`)
        .expect(200);

      expect(res.status).toBe(200);
      expect(res.body.data.cached).toBeUndefined();
    });
  });

  describe('Research Pipeline Caching Integration', () => {
    it('caches research response and serves subsequent query from cache', async () => {
      const query = 'Explain Redis persistence architecture';

      // 1. First call: Fresh synthesis
      const res1 = await request(app)
        .post('/api/v1/research')
        .send({ query, mode: 'HYBRID', maxSources: 3 })
        .expect(200);

      expect(res1.body.success).toBe(true);
      expect(res1.body.data.cached).toBeUndefined();

      // Give async cache write a moment to persist
      await new Promise((r) => setTimeout(r, 100));

      // 2. Second call: Served from exact cache (L1)
      const res2 = await request(app)
        .post('/api/v1/research')
        .send({ query, mode: 'HYBRID', maxSources: 3 })
        .expect(200);

      expect(res2.body.success).toBe(true);
      expect(res2.body.data.cached).toBe(true);
      expect(res2.body.data.cacheType).toBe('EXACT');
      expect(res2.body.data.answer).toBe(res1.body.data.answer);
    });
  });
});
