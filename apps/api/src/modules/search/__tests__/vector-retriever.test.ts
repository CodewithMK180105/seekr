import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, getEmbeddingProvider } from '@seekr/shared';
import { VectorRetrieverService } from '../services/vector-retriever.service.js';
import { EmbeddingProvider } from '@seekr/shared';

describe('VectorRetrieverService Integration & Unit Tests', () => {
  let retriever: VectorRetrieverService;
  let testSourceId: string | undefined;

  beforeAll(async () => {
    retriever = new VectorRetrieverService(prisma, getEmbeddingProvider());
    const doc = await prisma.document.findFirst({
      select: { sourceId: true },
    });
    testSourceId = doc?.sourceId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Contract and Interface', () => {
    it('has retriever name "vector"', () => {
      expect(retriever.name).toBe('vector');
    });
  });

  describe('Input Normalization and Edge Cases', () => {
    it('returns empty array for empty or whitespace query', async () => {
      expect(await retriever.search('')).toEqual([]);
      expect(await retriever.search('   ')).toEqual([]);
      // @ts-expect-error test runtime invalid type
      expect(await retriever.search(null)).toEqual([]);
      // @ts-expect-error test runtime invalid type
      expect(await retriever.search(undefined)).toEqual([]);
    });

    it('handles query with non-standard characters safely', async () => {
      const results = await retriever.search('!@#$%^&*()_+');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Semantic Retrieval & Ranking', () => {
    it('performs semantic search and returns complete metadata', async () => {
      const results = await retriever.search('caching and in-memory key value store', 3);

      expect(results.length).toBeGreaterThan(0);
      const top = results[0];

      expect(top.source).toBe('vector');
      expect(top.rank).toBe(1);
      expect(typeof top.score).toBe('number');
      expect(typeof top.chunkId).toBe('string');
      expect(typeof top.documentId).toBe('string');
      expect(typeof top.chunkIndex).toBe('number');
      expect(typeof top.content).toBe('string');
      expect(typeof top.title).toBe('string');
      expect(typeof top.url).toBe('string');
      expect(typeof top.sourceType).toBe('string');
    });

    it('orders results by cosine similarity descending (score DESC)', async () => {
      const results = await retriever.search('operating system kernel and device drivers', 5, undefined, 0.40);

      expect(results.length).toBeGreaterThan(0);

      // Verify rank ordering and 1-based indexing
      for (let i = 0; i < results.length; i++) {
        expect(results[i].rank).toBe(i + 1);
        expect(results[i].source).toBe('vector');
        if (i > 0) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('retrieves relevant documents using conceptual similarity without exact verbatim keywords', async () => {
      // "computational procedures and Turing completeness" semantically aligns with Algorithms / Computing
      const results = await retriever.search('computational procedures and Turing completeness', 3);

      expect(results.length).toBeGreaterThan(0);
      const titles = results.map((r) => r.title.toLowerCase());
      const hasAlgorithmOrLinux = titles.some(
        (t) => t.includes('algorithm') || t.includes('turing') || t.includes('linux') || t.includes('redis')
      );
      expect(hasAlgorithmOrLinux).toBe(true);
    });

    it('respects the limit parameter and clamps safely', async () => {
      const limitTwo = await retriever.search('distributed computing', 2);
      expect(limitTwo.length).toBeLessThanOrEqual(2);

      // Negative limit clamped to at least 1
      const clampedNegative = await retriever.search('distributed computing', -3);
      expect(clampedNegative.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Source Scoping & Filtering', () => {
    it('scopes results to specific sourceId when provided', async () => {
      if (!testSourceId) {
        return;
      }

      const results = await retriever.search('data', 5, testSourceId);
      for (const item of results) {
        const doc = await prisma.document.findUnique({
          where: { id: item.documentId },
          select: { sourceId: true },
        });
        expect(doc?.sourceId).toBe(testSourceId);
      }
    });

    it('returns empty array when sourceId is invalid UUID format', async () => {
      const results = await retriever.search('redis', 5, 'invalid-uuid');
      expect(results).toEqual([]);
    });

    it('returns empty array when sourceId does not exist', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const results = await retriever.search('redis', 5, nonExistentUuid);
      expect(results).toEqual([]);
    });
  });

  describe('Resilience and Degradation Handling', () => {
    it('returns empty array gracefully when embedding provider fails', async () => {
      const faultyProvider: EmbeddingProvider = {
        name: 'faulty',
        dimension: 768,
        embedText: async () => {
          throw new Error('API Quota Exceeded');
        },
        embedBatch: async () => {
          throw new Error('API Quota Exceeded');
        },
      };

      const resilientRetriever = new VectorRetrieverService(prisma, faultyProvider);
      const results = await resilientRetriever.search('any query', 5);
      expect(results).toEqual([]);
    });

    it('returns empty array gracefully when embedding provider returns empty vector', async () => {
      const emptyVectorProvider: EmbeddingProvider = {
        name: 'empty',
        dimension: 768,
        embedText: async () => [],
        embedBatch: async () => [[]],
      };

      const resilientRetriever = new VectorRetrieverService(prisma, emptyVectorProvider);
      const results = await resilientRetriever.search('any query', 5);
      expect(results).toEqual([]);
    });
  });

  describe('Relevance Threshold and Gibberish Rejection', () => {
    it('rejects low-confidence or gibberish queries with zero qualifying results', async () => {
      // With calibrated threshold (0.58), unrelated queries like 'fttxtx' (~0.507 score) return 0 results
      const results = await retriever.search('fttxtx', 10);
      expect(results).toEqual([]);
    });

    it('enforces customMinSimilarity threshold strictly', async () => {
      // With impossible threshold 0.99, no chunk qualifies
      const results = await retriever.search('caching and memory', 5, undefined, 0.99);
      expect(results).toEqual([]);
    });
  });
});
