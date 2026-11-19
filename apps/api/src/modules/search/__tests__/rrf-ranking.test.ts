import { describe, it, expect } from 'vitest';
import { RrfRankingService } from '../services/rrf-ranking.service.js';
import { RankedSearchResult } from '../search.types.js';

describe('RrfRankingService Unit Tests', () => {
  const rrf = new RrfRankingService();

  const createDummyResult = (
    chunkId: string,
    rank: number,
    source: 'keyword' | 'vector',
    score: number = 0.5
  ): RankedSearchResult => ({
    chunkId,
    documentId: `doc-${chunkId}`,
    chunkIndex: 0,
    content: `Content for ${chunkId}`,
    title: `Title for ${chunkId}`,
    url: `https://example.com/${chunkId}`,
    sourceType: 'DOCUMENTATION',
    rank,
    score,
    source,
  });

  it('1. handles keyword-only results correctly', () => {
    const kw = [createDummyResult('chunk-1', 1, 'keyword', 0.9)];
    const vec: RankedSearchResult[] = [];

    const fused = rrf.fuse(kw, vec);

    expect(fused).toHaveLength(1);
    expect(fused[0].chunkId).toBe('chunk-1');
    expect(fused[0].keywordRank).toBe(1);
    expect(fused[0].vectorRank).toBeNull();
    expect(fused[0].matchedBy).toEqual({ keyword: true, vector: false });
    expect(fused[0].fusedScore).toBeCloseTo(1 / (60 + 1));
  });

  it('2. handles semantic-only results correctly', () => {
    const kw: RankedSearchResult[] = [];
    const vec = [createDummyResult('chunk-2', 1, 'vector', 0.85)];

    const fused = rrf.fuse(kw, vec);

    expect(fused).toHaveLength(1);
    expect(fused[0].chunkId).toBe('chunk-2');
    expect(fused[0].keywordRank).toBeNull();
    expect(fused[0].vectorRank).toBe(1);
    expect(fused[0].matchedBy).toEqual({ keyword: false, vector: true });
    expect(fused[0].fusedScore).toBeCloseTo(1 / (60 + 1));
  });

  it('3. handles results present in both lists and sums reciprocal ranks', () => {
    const kw = [createDummyResult('chunk-both', 1, 'keyword')];
    const vec = [createDummyResult('chunk-both', 3, 'vector')];

    const fused = rrf.fuse(kw, vec);

    expect(fused).toHaveLength(1);
    expect(fused[0].chunkId).toBe('chunk-both');
    expect(fused[0].keywordRank).toBe(1);
    expect(fused[0].vectorRank).toBe(3);
    expect(fused[0].matchedBy).toEqual({ keyword: true, vector: true });

    const expectedScore = 1 / (60 + 1) + 1 / (60 + 3);
    expect(fused[0].fusedScore).toBeCloseTo(expectedScore, 6);
  });

  it('4. calculates exact RRF score mathematically with custom k', () => {
    const kw = [createDummyResult('chunk-a', 2, 'keyword')];
    const vec = [createDummyResult('chunk-a', 4, 'vector')];

    const fused = rrf.fuse(kw, vec, { k: 20 });

    const expectedScore = 1 / (20 + 2) + 1 / (20 + 4);
    expect(fused[0].fusedScore).toBeCloseTo(expectedScore, 8);
  });

  it('5. accurately tracks individual keywordRank and vectorRank', () => {
    const kw = [
      createDummyResult('chunk-1', 1, 'keyword'),
      createDummyResult('chunk-2', 2, 'keyword'),
    ];
    const vec = [
      createDummyResult('chunk-2', 1, 'vector'),
      createDummyResult('chunk-3', 2, 'vector'),
    ];

    const fused = rrf.fuse(kw, vec);

    const chunk1 = fused.find((r) => r.chunkId === 'chunk-1');
    const chunk2 = fused.find((r) => r.chunkId === 'chunk-2');
    const chunk3 = fused.find((r) => r.chunkId === 'chunk-3');

    expect(chunk1).toBeDefined();
    expect(chunk1!.keywordRank).toBe(1);
    expect(chunk1!.vectorRank).toBeNull();

    expect(chunk2).toBeDefined();
    expect(chunk2!.keywordRank).toBe(2);
    expect(chunk2!.vectorRank).toBe(1);

    expect(chunk3).toBeDefined();
    expect(chunk3!.keywordRank).toBeNull();
    expect(chunk3!.vectorRank).toBe(2);
  });

  it('6. correctly sets matchedBy flags for all combinations', () => {
    const kw = [createDummyResult('kw-only', 1, 'keyword'), createDummyResult('both', 2, 'keyword')];
    const vec = [createDummyResult('both', 1, 'vector'), createDummyResult('vec-only', 2, 'vector')];

    const fused = rrf.fuse(kw, vec);

    const map = new Map(fused.map((f) => [f.chunkId, f.matchedBy]));
    expect(map.get('kw-only')).toEqual({ keyword: true, vector: false });
    expect(map.get('vec-only')).toEqual({ keyword: false, vector: true });
    expect(map.get('both')).toEqual({ keyword: true, vector: true });
  });

  it('7. deduplicates by chunkId across multiple retrievers', () => {
    const kw = [
      createDummyResult('chunk-shared-1', 1, 'keyword'),
      createDummyResult('chunk-shared-2', 2, 'keyword'),
    ];
    const vec = [
      createDummyResult('chunk-shared-1', 1, 'vector'),
      createDummyResult('chunk-shared-2', 2, 'vector'),
    ];

    const fused = rrf.fuse(kw, vec);
    expect(fused).toHaveLength(2);
    const ids = fused.map((r) => r.chunkId);
    expect(ids).toEqual(['chunk-shared-1', 'chunk-shared-2']);
  });

  it('8. handles empty keyword results gracefully', () => {
    const vec = [createDummyResult('chunk-1', 1, 'vector')];
    const fused = rrf.fuse([], vec);

    expect(fused).toHaveLength(1);
    expect(fused[0].chunkId).toBe('chunk-1');
  });

  it('9. handles empty semantic results gracefully', () => {
    const kw = [createDummyResult('chunk-1', 1, 'keyword')];
    const fused = rrf.fuse(kw, []);

    expect(fused).toHaveLength(1);
    expect(fused[0].chunkId).toBe('chunk-1');
  });

  it('10. returns empty array when both inputs are empty', () => {
    expect(rrf.fuse([], [])).toEqual([]);
    // @ts-expect-error test defaults
    expect(rrf.fuse(undefined, undefined)).toEqual([]);
  });

  it('11. safely handles duplicate IDs within the same input list by retaining best rank', () => {
    const kw = [
      createDummyResult('chunk-dup', 3, 'keyword'),
      createDummyResult('chunk-dup', 1, 'keyword'), // better rank
    ];
    const vec: RankedSearchResult[] = [];

    const fused = rrf.fuse(kw, vec);

    expect(fused).toHaveLength(1);
    expect(fused[0].keywordRank).toBe(1);
    expect(fused[0].fusedScore).toBeCloseTo(1 / (60 + 1));
  });

  it('12. performs deterministic tie-breaking on equal RRF scores (chunkId ASC)', () => {
    // Both chunk-b and chunk-a have identical rank 1 in keyword and nothing in vector
    const kw = [
      createDummyResult('chunk-z', 1, 'keyword'),
      createDummyResult('chunk-a', 1, 'keyword'),
    ];
    const vec: RankedSearchResult[] = [];

    const fused = rrf.fuse(kw, vec);

    expect(fused).toHaveLength(2);
    expect(fused[0].fusedScore).toBe(fused[1].fusedScore);
    // Deterministic tie-breaker should place chunk-a before chunk-z
    expect(fused[0].chunkId).toBe('chunk-a');
    expect(fused[1].chunkId).toBe('chunk-z');
  });

  it('13. does not mutate input arrays or their objects', () => {
    const kwItem = createDummyResult('chunk-1', 1, 'keyword');
    const vecItem = createDummyResult('chunk-1', 2, 'vector');

    const kw = [kwItem];
    const vec = [vecItem];

    const kwCopy = JSON.parse(JSON.stringify(kw));
    const vecCopy = JSON.parse(JSON.stringify(vec));

    rrf.fuse(kw, vec);

    expect(kw).toEqual(kwCopy);
    expect(vec).toEqual(vecCopy);
    expect(kw).toHaveLength(1);
    expect(vec).toHaveLength(1);
  });
});
