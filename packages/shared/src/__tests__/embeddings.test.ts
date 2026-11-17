import { describe, it, expect } from 'vitest';
import { MockEmbeddingProvider, getEmbeddingProvider } from '../embeddings/index.js';

describe('Embedding Providers', () => {
  describe('MockEmbeddingProvider', () => {
    const provider = new MockEmbeddingProvider();

    it('should have 768 dimensions and name mock', () => {
      expect(provider.name).toBe('mock');
      expect(provider.dimension).toBe(768);
    });

    it('should generate deterministic unit-normalized 768-dim vector', async () => {
      const text = 'Hybrid search combines lexical and semantic retrieval';
      const vector1 = await provider.embedText(text);
      const vector2 = await provider.embedText(text);

      expect(vector1).toHaveLength(768);
      expect(vector2).toHaveLength(768);
      expect(vector1).toEqual(vector2);

      // Verify L2 unit normalization (norm ≈ 1.0)
      const norm = Math.sqrt(vector1.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeGreaterThan(0.99);
      expect(norm).toBeLessThan(1.01);
    });

    it('should produce distinct vectors for distinct text inputs', async () => {
      const vecA = await provider.embedText('Apples and oranges');
      const vecB = await provider.embedText('Quantum computing and superconduction');

      expect(vecA).not.toEqual(vecB);
    });

    it('should support batch embedding consistently', async () => {
      const batch = ['first document chunk', 'second document chunk'];
      const results = await provider.embedBatch(batch);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveLength(768);
      expect(results[1]).toHaveLength(768);

      const singleFirst = await provider.embedText(batch[0]);
      expect(results[0]).toEqual(singleFirst);
    });
  });

  describe('getEmbeddingProvider Factory', () => {
    it('should return a valid provider conforming to EmbeddingProvider interface', () => {
      const provider = getEmbeddingProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.embedText).toBe('function');
      expect(typeof provider.embedBatch).toBe('function');
      expect(provider.dimension).toBeGreaterThan(0);
    });
  });
});
