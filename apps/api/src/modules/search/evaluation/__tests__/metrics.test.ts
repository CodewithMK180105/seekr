import { describe, it, expect } from 'vitest';
import {
  precisionAtK,
  recallAtK,
  reciprocalRank,
  dcgAtK,
  ndcgAtK,
} from '../metrics.js';
import { BenchmarkGroundTruthItem } from '../types.js';

describe('Search Quality Evaluation Metrics', () => {
  const groundTruth: BenchmarkGroundTruthItem[] = [
    { chunkId: 'c1', relevance: 3 },
    { chunkId: 'c2', relevance: 3 },
    { chunkId: 'c3', relevance: 2 },
    { chunkId: 'c4', relevance: 2 },
    { chunkId: 'c5', relevance: 1 }, // Weakly relevant (< threshold 2)
    { chunkId: 'c6', relevance: 0 }, // Irrelevant
  ];

  describe('Precision@K', () => {
    it('calculates 1.0 for a perfect top-10 containing only relevant items', () => {
      const tenRelevantGT: BenchmarkGroundTruthItem[] = Array.from({ length: 10 }, (_, i) => ({
        chunkId: `doc-${i}`,
        relevance: 2,
      }));
      const retrieved = Array.from({ length: 10 }, (_, i) => `doc-${i}`);

      expect(precisionAtK(retrieved, tenRelevantGT, 10)).toBe(1.0);
    });

    it('calculates precision using strictly K as denominator when fewer than K results are retrieved', () => {
      // 3 items retrieved, 2 relevant -> 2 / 10 = 0.2
      const retrieved = ['c1', 'c2', 'unrelated-1'];
      expect(precisionAtK(retrieved, groundTruth, 10)).toBe(0.2);
    });

    it('respects the relevance threshold (>= 2 is relevant, 1 is not)', () => {
      // c1 (3), c5 (1), c6 (0) -> only c1 qualifies -> 1 / 10 = 0.1
      const retrieved = ['c1', 'c5', 'c6'];
      expect(precisionAtK(retrieved, groundTruth, 10)).toBe(0.1);
    });

    it('returns 0 for empty retrieved list', () => {
      expect(precisionAtK([], groundTruth, 10)).toBe(0);
    });
  });

  describe('Recall@K', () => {
    it('calculates 1.0 when all 4 relevant ground-truth items are retrieved in top-K', () => {
      // c1, c2, c3, c4 are relevant (relevance >= 2)
      const retrieved = ['c1', 'c2', 'other-1', 'c3', 'other-2', 'c4'];
      expect(recallAtK(retrieved, groundTruth, 10)).toBe(1.0);
    });

    it('calculates partial recall when only a subset of relevant items are retrieved', () => {
      // 2 of 4 relevant items retrieved -> 2 / 4 = 0.5
      const retrieved = ['c1', 'c3', 'unrelated-1', 'unrelated-2'];
      expect(recallAtK(retrieved, groundTruth, 10)).toBe(0.5);
    });

    it('returns 0 when no relevant items are retrieved', () => {
      const retrieved = ['c5', 'c6', 'unknown-1'];
      expect(recallAtK(retrieved, groundTruth, 10)).toBe(0);
    });

    it('returns 0 safely when ground truth contains no relevant items', () => {
      const emptyGT: BenchmarkGroundTruthItem[] = [{ chunkId: 'c1', relevance: 1 }];
      expect(recallAtK(['c1'], emptyGT, 10)).toBe(0);
    });
  });

  describe('Mean Reciprocal Rank (MRR)', () => {
    it('returns 1.0 when the first retrieved result is relevant (rank 1)', () => {
      expect(reciprocalRank(['c1', 'c2', 'c3'], groundTruth)).toBe(1.0);
    });

    it('returns 0.5 when the first relevant result is at rank 2', () => {
      expect(reciprocalRank(['unrelated-1', 'c2', 'c3'], groundTruth)).toBe(0.5);
    });

    it('returns 0.2 when the first relevant result is at rank 5', () => {
      const retrieved = ['unrelated-1', 'unrelated-2', 'c5', 'unrelated-4', 'c3'];
      expect(reciprocalRank(retrieved, groundTruth)).toBe(0.2);
    });

    it('returns 0 when no relevant results are retrieved', () => {
      expect(reciprocalRank(['c5', 'c6', 'other'], groundTruth)).toBe(0);
      expect(reciprocalRank([], groundTruth)).toBe(0);
    });
  });

  describe('nDCG@K', () => {
    it('returns 1.0 for the ideal ranking of ground-truth grades', () => {
      // Ideal order: c1(3), c2(3), c3(2), c4(2), c5(1), c6(0)
      const idealRanking = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
      expect(ndcgAtK(idealRanking, groundTruth, 10)).toBe(1.0);
    });

    it('returns < 1.0 for non-ideal or inverted ranking', () => {
      // Inverted order: c5(1), c4(2), c3(2), c2(3), c1(3)
      const subIdealRanking = ['c5', 'c4', 'c3', 'c2', 'c1'];
      const score = ndcgAtK(subIdealRanking, groundTruth, 10);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1.0);
    });

    it('handles empty results returning 0', () => {
      expect(ndcgAtK([], groundTruth, 10)).toBe(0);
    });

    it('handles IDCG = 0 safely when ground truth has no positive grades', () => {
      const allZeroGT: BenchmarkGroundTruthItem[] = [{ chunkId: 'c1', relevance: 0 }];
      expect(ndcgAtK(['c1'], allZeroGT, 10)).toBe(0);
    });

    it('calculates DCG exponential gains accurately: (2^rel - 1) / log2(rank + 1)', () => {
      // Rank 1: relevance 3 -> (2^3 - 1) / log2(2) = 7 / 1 = 7
      // Rank 2: relevance 1 -> (2^1 - 1) / log2(3) = 1 / 1.58496 = 0.6309
      const retrieved = ['c1', 'c5'];
      const dcg = dcgAtK(retrieved, groundTruth, 2);
      expect(dcg).toBeCloseTo(7 + 1 / Math.log2(3), 4);
    });
  });
});
