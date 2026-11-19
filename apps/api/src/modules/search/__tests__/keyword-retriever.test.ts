import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@seekr/shared';
import { KeywordRetrieverService } from '../services/keyword-retriever.service.js';

describe('KeywordRetrieverService Integration & Unit Tests', () => {
  let retriever: KeywordRetrieverService;
  let testSourceId: string | undefined;

  beforeAll(async () => {
    retriever = new KeywordRetrieverService(prisma);
    const doc = await prisma.document.findFirst({
      select: { sourceId: true },
    });
    testSourceId = doc?.sourceId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Contract and Interface', () => {
    it('has retriever name "keyword"', () => {
      expect(retriever.name).toBe('keyword');
    });
  });

  describe('Input Normalization and Edge Cases', () => {
    it('returns empty array for empty or whitespace query', async () => {
      expect(await retriever.search('')).toEqual([]);
      expect(await retriever.search('   ')).toEqual([]);
      // @ts-expect-error test non-string input at runtime
      expect(await retriever.search(null)).toEqual([]);
      // @ts-expect-error test non-string input at runtime
      expect(await retriever.search(undefined)).toEqual([]);
    });

    it('handles stop-word-only queries gracefully without error', async () => {
      const results = await retriever.search('the and of or');
      expect(results).toEqual([]);
    });

    it('handles punctuation-only queries gracefully without error', async () => {
      const results = await retriever.search('!@#$%^&*()_+');
      expect(results).toEqual([]);
    });

    it('handles malformed query syntax (unclosed quotes, boolean words) gracefully', async () => {
      const res1 = await retriever.search('"unclosed quote');
      expect(Array.isArray(res1)).toBe(true);

      const res2 = await retriever.search('AND OR NOT');
      expect(Array.isArray(res2)).toBe(true);
    });

    it('returns empty array for queries with zero matches', async () => {
      const results = await retriever.search('nonexistenttermxyz99999');
      expect(results).toEqual([]);
    });
  });

  describe('Lexical Retrieval & Ranking', () => {
    it('performs exact term matching and returns complete metadata', async () => {
      const results = await retriever.search('redis', 5);

      expect(results.length).toBeGreaterThan(0);
      const top = results[0];

      expect(top.source).toBe('keyword');
      expect(top.rank).toBe(1);
      expect(top.score).toBeGreaterThan(0);
      expect(typeof top.chunkId).toBe('string');
      expect(typeof top.documentId).toBe('string');
      expect(typeof top.chunkIndex).toBe('number');
      expect(typeof top.content).toBe('string');
      expect(typeof top.title).toBe('string');
      expect(typeof top.url).toBe('string');
      expect(typeof top.sourceType).toBe('string');
    });

    it('performs multi-word queries with cover density ranking (score DESC)', async () => {
      const results = await retriever.search('redis persistence', 5);

      expect(results.length).toBeGreaterThan(0);

      // Verify rank ordering and 1-based indexing
      for (let i = 0; i < results.length; i++) {
        expect(results[i].rank).toBe(i + 1);
        expect(results[i].source).toBe('keyword');
        if (i > 0) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('supports websearch phrase queries with double quotes', async () => {
      const results = await retriever.search('"code of conduct"', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content.toLowerCase()).toContain('code of conduct');
    });

    it('handles punctuation attached to valid terms', async () => {
      const results = await retriever.search('redis!', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content.toLowerCase()).toContain('redis');
    });

    it('respects the limit parameter and clamps safely', async () => {
      const limitTwo = await retriever.search('algorithm', 2);
      expect(limitTwo.length).toBeLessThanOrEqual(2);

      // Clamping: negative limit should be clamped to at least 1
      const clampedNegative = await retriever.search('algorithm', -1);
      expect(clampedNegative.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Source Scoping & Filtering', () => {
    it('scopes results to specific sourceId when provided', async () => {
      if (!testSourceId) {
        return;
      }

      const results = await retriever.search('redis', 10, testSourceId);
      for (const item of results) {
        const doc = await prisma.document.findUnique({
          where: { id: item.documentId },
          select: { sourceId: true },
        });
        expect(doc?.sourceId).toBe(testSourceId);
      }
    });

    it('returns empty array when sourceId is invalid UUID format', async () => {
      const results = await retriever.search('redis', 10, 'not-a-valid-uuid');
      expect(results).toEqual([]);
    });

    it('returns empty array when sourceId does not exist', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const results = await retriever.search('redis', 10, nonExistentUuid);
      expect(results).toEqual([]);
    });
  });
});
