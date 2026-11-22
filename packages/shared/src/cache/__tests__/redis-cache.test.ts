import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { RedisCacheService } from '../redisCacheService.js';
import { CachedEmbeddingProvider } from '../cachedEmbeddingProvider.js';
import { MockEmbeddingProvider } from '../../embeddings/mock.js';
import { getRedisClient } from '../../redis.js';

describe('RedisCacheService & CachedEmbeddingProvider', () => {
  const cache = new RedisCacheService();
  const redis = getRedisClient();

  beforeEach(async () => {
    await cache.clearAllExact();
    await cache.clearAllEmbeddings();
    await cache.resetStats();
  });

  afterAll(async () => {
    await cache.clearAllExact();
    await cache.clearAllEmbeddings();
    await cache.resetStats();
  });

  describe('Level 1: Exact Match Cache', () => {
    it('stores and retrieves cached search payload', async () => {
      const query = 'What is Redis persistence?';
      const payload = { test: true, data: [1, 2, 3] };

      // Miss on initial query
      const initial = await cache.getExact('SEARCH', query, 'HYBRID');
      expect(initial).toBeNull();

      // Store in exact cache
      await cache.setExact('SEARCH', query, payload, { mode: 'HYBRID', ttlSeconds: 60 });

      // Hit on subsequent query (normalized case-insensitively)
      const hit = await cache.getExact('SEARCH', '  what is redis persistence?  ', 'HYBRID');
      expect(hit).toEqual(payload);
    });

    it('distinguishes between different search modes', async () => {
      const query = 'algorithms and complexity';
      await cache.setExact('SEARCH', query, { mode: 'KEYWORD' }, { mode: 'KEYWORD' });
      await cache.setExact('SEARCH', query, { mode: 'SEMANTIC' }, { mode: 'SEMANTIC' });

      const kwHit = await cache.getExact<{ mode: string }>('SEARCH', query, 'KEYWORD');
      const semHit = await cache.getExact<{ mode: string }>('SEARCH', query, 'SEMANTIC');

      expect(kwHit?.mode).toBe('KEYWORD');
      expect(semHit?.mode).toBe('SEMANTIC');
    });

    it('invalidates entries by pattern', async () => {
      await cache.setExact('SEARCH', 'query one', { id: 1 });
      await cache.setExact('SEARCH', 'query two', { id: 2 });
      await cache.setExact('RESEARCH', 'query one', { id: 3 });

      const deleted = await cache.invalidatePattern('seekr:cache:exact:search*');
      expect(deleted).toBeGreaterThanOrEqual(2);

      expect(await cache.getExact('SEARCH', 'query one')).toBeNull();
      expect(await cache.getExact('SEARCH', 'query two')).toBeNull();
      expect(await cache.getExact('RESEARCH', 'query one')).not.toBeNull();
    });
  });

  describe('Level 3: CachedEmbeddingProvider', () => {
    it('caches single embedding vectors in Redis and avoids redundant provider calls', async () => {
      let callCount = 0;
      const baseMock = new MockEmbeddingProvider();
      const spyProvider = {
        name: 'mock',
        dimension: 768,
        embedText: async (text: string) => {
          callCount++;
          return baseMock.embedText(text);
        },
        embedBatch: async (texts: string[]) => {
          callCount += texts.length;
          return baseMock.embedBatch(texts);
        },
      };

      const cachedProvider = new CachedEmbeddingProvider(spyProvider, cache);

      const text = 'Redis high availability and clustering';

      // 1. First call generates embedding
      const vec1 = await cachedProvider.embedText(text);
      expect(vec1.length).toBe(768);
      expect(callCount).toBe(1);

      // Give async cache write a tick to complete
      await new Promise((r) => setTimeout(r, 50));

      // 2. Second call retrieves from Redis cache without invoking base provider
      const vec2 = await cachedProvider.embedText(text);
      expect(vec2).toEqual(vec1);
      expect(callCount).toBe(1); // Provider NOT called again!
    });

    it('efficiently caches batch embeddings and only fetches missing vectors', async () => {
      let batchCallCount = 0;
      const baseMock = new MockEmbeddingProvider();
      const spyProvider = {
        name: 'mock',
        dimension: 768,
        embedText: async (text: string) => baseMock.embedText(text),
        embedBatch: async (texts: string[]) => {
          batchCallCount += texts.length;
          return baseMock.embedBatch(texts);
        },
      };

      const cachedProvider = new CachedEmbeddingProvider(spyProvider, cache);

      // Pre-seed vector for "item A" in cache
      await cachedProvider.embedText('item A');
      await new Promise((r) => setTimeout(r, 50));

      // Request batch for ["item A", "item B", "item C"]
      const batchVectors = await cachedProvider.embedBatch(['item A', 'item B', 'item C']);
      expect(batchVectors.length).toBe(3);
      expect(batchVectors[0].length).toBe(768);
      // Only "item B" and "item C" were requested from the base provider
      expect(batchCallCount).toBe(2);
    });
  });

  describe('Cache Metrics & Stats', () => {
    it('accurately tracks hits, misses, and hit ratios', async () => {
      await cache.recordHit('EXACT');
      await cache.recordHit('EXACT');
      await cache.recordHit('SEMANTIC');
      await cache.recordMiss();

      const stats = await cache.getStats();
      expect(stats.exactHitCount).toBe(2);
      expect(stats.semanticHitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.totalLookups).toBe(4);
      expect(stats.exactHitRatio).toBe(0.5);
      expect(stats.semanticHitRatio).toBe(0.25);
      expect(stats.totalHitRatio).toBe(0.75);

      await cache.resetStats();
      const reset = await cache.getStats();
      expect(reset.totalLookups).toBe(0);
    });
  });
});
