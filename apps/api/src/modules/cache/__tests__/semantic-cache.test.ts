import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SemanticCacheService } from '../semantic-cache.service.js';
import { prisma, RedisCacheService, MockEmbeddingProvider } from '@seekr/shared';

describe('SemanticCacheService Integration Tests', () => {
  const redisCache = new RedisCacheService();
  const semanticCache = new SemanticCacheService(redisCache);
  const mockProvider = new MockEmbeddingProvider();

  beforeEach(async () => {
    await semanticCache.invalidate();
    await redisCache.clearAllExact();
    await redisCache.resetStats();
  });

  afterAll(async () => {
    await semanticCache.invalidate();
    await redisCache.clearAllExact();
    await redisCache.resetStats();
  });

  it('stores payload and retrieves it via L1 Redis exact match', async () => {
    const query = 'How does Redis persistence work?';
    const payload = { answer: 'Redis uses RDB and AOF.', results: ['doc1'] };

    // Store in cache
    await semanticCache.store({
      cacheType: 'SEARCH',
      query,
      searchMode: 'HYBRID',
      payload,
    });

    // Exact match lookup (L1)
    const match = await semanticCache.findMatch<typeof payload>({
      cacheType: 'SEARCH',
      query: '  how does redis persistence work?  ',
      searchMode: 'HYBRID',
    });

    expect(match.matched).toBe(true);
    expect(match.matchStrategy).toBe('EXACT');
    expect(match.similarity).toBe(1.0);
    expect(match.payload).toEqual(payload);
  });

  it('finds semantic match (L2) in PostgreSQL pgvector for identical vector embedding', async () => {
    const originalQuery = 'How does Redis persistence work?';
    const payload = { answer: 'Redis uses RDB and AOF.', results: ['doc1'] };

    // Generate deterministic embedding
    const embedding = await mockProvider.embedText(originalQuery);

    // Store in semantic cache
    await semanticCache.store({
      cacheType: 'SEARCH',
      query: originalQuery,
      searchMode: 'HYBRID',
      embedding,
      payload,
    });

    // Clear L1 exact cache to force Level 2 pgvector semantic lookup
    await redisCache.clearAllExact();

    // Query with the same embedding (similarity = 1.0)
    const match = await semanticCache.findMatch<typeof payload>({
      cacheType: 'SEARCH',
      query: 'Tell me about Redis persistence mechanism',
      searchMode: 'HYBRID',
      embedding,
      similarityThreshold: 0.95,
    });

    expect(match.matched).toBe(true);
    expect(match.matchStrategy).toBe('SEMANTIC');
    expect(match.similarity).toBeGreaterThanOrEqual(0.95);
    expect(match.payload).toEqual(payload);
    expect(match.hitCount).toBe(2);
  });

  it('rejects semantic match when cosine similarity is below threshold', async () => {
    const query1 = 'PostgreSQL database indexing';
    const query2 = 'Frontend styling with Tailwind CSS';

    const emb1 = await mockProvider.embedText(query1);
    const emb2 = await mockProvider.embedText(query2);

    await semanticCache.store({
      cacheType: 'SEARCH',
      query: query1,
      embedding: emb1,
      payload: { data: 'indexing info' },
    });

    // Clear L1 exact cache
    await redisCache.clearAllExact();

    // Query with distinct embedding
    const match = await semanticCache.findMatch({
      cacheType: 'SEARCH',
      query: query2,
      embedding: emb2,
      similarityThreshold: 0.95,
    });

    expect(match.matched).toBe(false);
  });

  it('bypasses cache when skipCache option is enabled', async () => {
    const query = 'Cached query';
    await semanticCache.store({
      cacheType: 'RESEARCH',
      query,
      payload: { data: 'some research answer' },
    });

    const match = await semanticCache.findMatch({
      cacheType: 'RESEARCH',
      query,
      skipCache: true,
    });

    expect(match.matched).toBe(false);
  });

  it('respects TTL expiration and purges expired entries', async () => {
    const query = 'Short lived query';
    const embedding = await mockProvider.embedText(query);

    // Store entry with 1 second TTL
    await semanticCache.store({
      cacheType: 'SEARCH',
      query,
      embedding,
      payload: { ephemeral: true },
      ttlSeconds: 1,
    });

    // Manually expire entry in PostgreSQL for deterministic testing
    await prisma.$executeRaw`
      UPDATE semantic_cache 
      SET expires_at = NOW() - INTERVAL '10 seconds'
      WHERE query = ${query};
    `;

    // Clear L1 exact cache
    await redisCache.clearAllExact();

    // Query should miss due to expiration
    const match = await semanticCache.findMatch({
      cacheType: 'SEARCH',
      query,
      embedding,
    });
    expect(match.matched).toBe(false);

    // Cleanup removes the expired row
    const deletedCount = await semanticCache.cleanupExpired();
    expect(deletedCount).toBeGreaterThanOrEqual(1);
  });

  it('invalidates cache entries by type and aggregates stats', async () => {
    await semanticCache.store({
      cacheType: 'SEARCH',
      query: 'Search query',
      payload: { type: 'search' },
    });
    await semanticCache.store({
      cacheType: 'RESEARCH',
      query: 'Research query',
      payload: { type: 'research' },
    });

    // Invalidate SEARCH only
    const result = await semanticCache.invalidate('SEARCH');
    expect(result.semanticDeleted).toBeGreaterThanOrEqual(1);

    const stats = await semanticCache.getStats();
    expect(stats.activeEntriesCount).toBe(1); // Only RESEARCH remains
  });
});
