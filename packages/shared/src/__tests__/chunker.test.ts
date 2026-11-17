import { describe, it, expect } from 'vitest';
import { chunkDocument, estimateTokenCount } from '../chunker.js';

describe('Chunker Utility', () => {
  it('should return empty array for empty or whitespace-only text', () => {
    expect(chunkDocument('')).toEqual([]);
    expect(chunkDocument('   \n\t  ')).toEqual([]);
  });

  it('should accurately estimate token counts', () => {
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('hello world')).toBe(3); // 11 chars / 4 = 3
    const text = 'The quick brown fox jumps over the lazy dog.';
    expect(estimateTokenCount(text)).toBeGreaterThanOrEqual(9);
  });

  it('should return a single chunk if text is smaller than maxTokens', () => {
    const text = 'Redis is an in-memory database that persists on disk. It is ultra-fast and widely used.';
    const chunks = chunkDocument(text, { maxTokens: 400 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('should preserve sentence boundaries and split into overlapping chunks', () => {
    const sentences = [
      'PostgreSQL is an advanced, enterprise-class open-source relational database system.',
      'It supports both SQL relational and JSON querying capabilities.',
      'With pgvector, PostgreSQL becomes a scalable vector database for AI embeddings.',
      'Developers can store high-dimensional vectors directly alongside structured relational metadata.',
      'Reciprocal Rank Fusion blends dense vector similarity with sparse full-text lexical ranking.',
      'This hybrid approach delivers higher precision and recall than either system alone.',
      'BullMQ orchestrates distributed background crawling and indexing jobs reliably with Redis.',
      'Prisma provides type-safe query construction and schema management for migrations.',
    ];
    const fullText = sentences.join(' ');

    // Set maxTokens to roughly 40 tokens and overlap to 15 tokens to trigger multi-chunking
    const chunks = chunkDocument(fullText, { maxTokens: 40, overlapTokens: 15 });

    expect(chunks.length).toBeGreaterThan(1);

    // Verify sequential chunk indexing
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    });

    // Check sentence boundary preservation: chunks should not start or end with a broken mid-sentence word
    for (const chunk of chunks) {
      const startsWithSentence = sentences.some((s) => chunk.content.startsWith(s.slice(0, 20)));
      expect(startsWithSentence).toBe(true);
    }

    // Verify overlap exists between consecutive chunks: chunk 1 should share a sentence with chunk 0
    if (chunks.length >= 2) {
      const chunk0Words = new Set(chunks[0].content.split(/\s+/));
      const chunk1Words = chunks[1].content.split(/\s+/);
      const sharedWords = chunk1Words.filter((w) => chunk0Words.has(w));
      expect(sharedWords.length).toBeGreaterThan(3);
    }
  });

  it('should handle a single sentence larger than maxTokens gracefully', () => {
    const longSentence = 'A'.repeat(500) + ' and another clause with many details.';
    const chunks = chunkDocument(longSentence, { maxTokens: 50 });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toContain(longSentence);
  });
});
