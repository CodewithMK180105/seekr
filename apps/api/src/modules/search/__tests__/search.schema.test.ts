import { describe, it, expect } from 'vitest';
import {
  searchQuerySchema,
  suggestionsQuerySchema,
  searchFeedbackSchema,
} from '../search.schema.js';

describe('Search Validation Schemas', () => {
  describe('searchQuerySchema', () => {
    it('should validate valid query and supply defaults', () => {
      const parsed = searchQuerySchema.parse({ q: 'redis persistence' });

      expect(parsed.q).toBe('redis persistence');
      expect(parsed.mode).toBe('HYBRID');
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.sourceId).toBeUndefined();
    });

    it('should normalize lowercase mode to uppercase enum', () => {
      const parsedKeyword = searchQuerySchema.parse({ q: 'aof', mode: 'keyword' });
      expect(parsedKeyword.mode).toBe('KEYWORD');

      const parsedSemantic = searchQuerySchema.parse({ q: 'aof', mode: 'semantic' });
      expect(parsedSemantic.mode).toBe('SEMANTIC');

      const parsedHybrid = searchQuerySchema.parse({ q: 'aof', mode: 'hybrid' });
      expect(parsedHybrid.mode).toBe('HYBRID');
    });

    it('should coerce string numbers for page and limit', () => {
      const parsed = searchQuerySchema.parse({
        q: 'redis',
        page: '3',
        limit: '25',
      });

      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(25);
    });

    it('should reject empty or whitespace query', () => {
      expect(() => searchQuerySchema.parse({ q: '' })).toThrow();
      expect(() => searchQuerySchema.parse({ q: '   ' })).toThrow();
    });

    it('should reject invalid search mode', () => {
      expect(() => searchQuerySchema.parse({ q: 'test', mode: 'FUZZY' })).toThrow();
    });

    it('should reject non-positive page or limit > 100', () => {
      expect(() => searchQuerySchema.parse({ q: 'test', page: 0 })).toThrow();
      expect(() => searchQuerySchema.parse({ q: 'test', page: -1 })).toThrow();
      expect(() => searchQuerySchema.parse({ q: 'test', limit: 101 })).toThrow();
    });

    it('should validate optional sourceId UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const parsed = searchQuerySchema.parse({ q: 'test', sourceId: validUuid });
      expect(parsed.sourceId).toBe(validUuid);

      expect(() => searchQuerySchema.parse({ q: 'test', sourceId: 'not-a-uuid' })).toThrow();
    });
  });

  describe('suggestionsQuerySchema', () => {
    it('should validate prefix query and apply default limit 5', () => {
      const parsed = suggestionsQuerySchema.parse({ q: 'red' });
      expect(parsed.q).toBe('red');
      expect(parsed.limit).toBe(5);
    });

    it('should reject empty prefix query', () => {
      expect(() => suggestionsQuerySchema.parse({ q: '' })).toThrow();
      expect(() => suggestionsQuerySchema.parse({ q: '   ' })).toThrow();
    });

    it('should reject limit exceeding 10', () => {
      expect(() => suggestionsQuerySchema.parse({ q: 'red', limit: 15 })).toThrow();
    });
  });

  describe('searchFeedbackSchema', () => {
    const validSearchId = '123e4567-e89b-12d3-a456-426614174000';
    const validChunkId = '987fcdeb-51a2-43f7-9876-ba0987654321';

    it('should validate correct feedback click payload', () => {
      const parsed = searchFeedbackSchema.parse({
        searchId: validSearchId,
        chunkId: validChunkId,
        action: 'click',
      });

      expect(parsed.searchId).toBe(validSearchId);
      expect(parsed.chunkId).toBe(validChunkId);
      expect(parsed.action).toBe('click');
    });

    it('should reject non-UUID identifiers', () => {
      expect(() =>
        searchFeedbackSchema.parse({
          searchId: 'invalid-id',
          chunkId: validChunkId,
          action: 'click',
        })
      ).toThrow();

      expect(() =>
        searchFeedbackSchema.parse({
          searchId: validSearchId,
          chunkId: 'invalid-id',
          action: 'click',
        })
      ).toThrow();
    });

    it('should reject unsupported feedback action', () => {
      expect(() =>
        searchFeedbackSchema.parse({
          searchId: validSearchId,
          chunkId: validChunkId,
          action: 'hover',
        })
      ).toThrow();
    });
  });
});
