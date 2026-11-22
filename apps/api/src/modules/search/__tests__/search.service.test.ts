import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../services/search.service.js';
import { RrfRankingService } from '../services/rrf-ranking.service.js';
import { Retriever, RankedSearchResult } from '../search.types.js';

describe('SearchService Unit Tests', () => {
  let mockKeywordRetriever: Retriever;
  let mockVectorRetriever: Retriever;
  let rrfService: RrfRankingService;
  let searchService: SearchService;

  const createDummyRanked = (
    id: string,
    rank: number,
    source: 'keyword' | 'vector',
    score: number = 0.5
  ): RankedSearchResult => ({
    chunkId: id,
    documentId: `doc-${id}`,
    chunkIndex: 0,
    content: `Content for ${id}`,
    title: `Title ${id}`,
    url: `https://example.com/${id}`,
    sourceType: 'DOCUMENTATION',
    rank,
    score,
    source,
  });

  beforeEach(() => {
    mockKeywordRetriever = {
      name: 'keyword',
      search: vi.fn(),
    };
    mockVectorRetriever = {
      name: 'vector',
      search: vi.fn(),
    };
    rrfService = new RrfRankingService();
    const mockLogging = { logSearch: vi.fn().mockResolvedValue(undefined) } as any;
    const mockCache = {
      findMatch: vi.fn().mockResolvedValue({ matched: false }),
      store: vi.fn().mockResolvedValue(undefined),
    } as any;
    searchService = new SearchService(
      mockKeywordRetriever,
      mockVectorRetriever,
      rrfService,
      mockLogging,
      mockCache
    );
  });

  it('1. KEYWORD mode invokes keyword retriever only and maps metadata correctly', async () => {
    const kwResults = [createDummyResult('chunk-kw-1', 1, 'keyword', 0.8)];
    (mockKeywordRetriever.search as any).mockResolvedValue(kwResults);

    const res = await searchService.search({
      query: 'distributed',
      mode: 'KEYWORD',
      page: 1,
      limit: 10,
    });

    expect(mockKeywordRetriever.search).toHaveBeenCalledWith('distributed', expect.any(Number), undefined);
    expect(mockVectorRetriever.search).not.toHaveBeenCalled();

    expect(res.mode).toBe('KEYWORD');
    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('chunk-kw-1');
    expect(res.results[0].keywordRank).toBe(1);
    expect(res.results[0].vectorRank).toBeNull();
    expect(res.results[0].matchedBy).toEqual({ keyword: true, vector: false });
  });

  it('2. SEMANTIC mode invokes semantic retriever only and maps metadata correctly', async () => {
    const vecResults = [createDummyResult('chunk-vec-1', 1, 'vector', 0.95)];
    (mockVectorRetriever.search as any).mockResolvedValue(vecResults);

    const res = await searchService.search({
      query: 'vectors',
      mode: 'SEMANTIC',
      page: 1,
      limit: 10,
    });

    expect(mockVectorRetriever.search).toHaveBeenCalledWith('vectors', expect.any(Number), undefined);
    expect(mockKeywordRetriever.search).not.toHaveBeenCalled();

    expect(res.mode).toBe('SEMANTIC');
    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('chunk-vec-1');
    expect(res.results[0].keywordRank).toBeNull();
    expect(res.results[0].vectorRank).toBe(1);
    expect(res.results[0].matchedBy).toEqual({ keyword: false, vector: true });
  });

  it('3. HYBRID mode invokes both retrievers concurrently', async () => {
    (mockKeywordRetriever.search as any).mockResolvedValue([createDummyResult('c1', 1, 'keyword')]);
    (mockVectorRetriever.search as any).mockResolvedValue([createDummyResult('c2', 1, 'vector')]);

    const res = await searchService.search({
      query: 'hybrid test',
      mode: 'HYBRID',
      page: 1,
      limit: 10,
    });

    expect(mockKeywordRetriever.search).toHaveBeenCalled();
    expect(mockVectorRetriever.search).toHaveBeenCalled();
    expect(res.mode).toBe('HYBRID');
    expect(res.results).toHaveLength(2);
  });

  it('4. HYBRID mode uses RRF service and assigns correct fused score', async () => {
    const rrfSpy = vi.spyOn(rrfService, 'fuse');
    const kw = [createDummyResult('shared-chunk', 1, 'keyword')];
    const vec = [createDummyResult('shared-chunk', 2, 'vector')];

    (mockKeywordRetriever.search as any).mockResolvedValue(kw);
    (mockVectorRetriever.search as any).mockResolvedValue(vec);

    const res = await searchService.search({ query: 'shared', mode: 'HYBRID' });

    expect(rrfSpy).toHaveBeenCalledWith(kw, vec);
    expect(res.results).toHaveLength(1);
    expect(res.results[0].matchedBy).toEqual({ keyword: true, vector: true });
    expect(res.results[0].keywordRank).toBe(1);
    expect(res.results[0].vectorRank).toBe(2);
    expect(res.results[0].score).toBeCloseTo(1 / 61 + 1 / 62, 6);
  });

  it('5. returns empty results immediately for blank queries without invoking retrievers', async () => {
    const res = await searchService.search({ query: '   ' });

    expect(res.results).toHaveLength(0);
    expect(res.pagination.total).toBe(0);
    expect(mockKeywordRetriever.search).not.toHaveBeenCalled();
    expect(mockVectorRetriever.search).not.toHaveBeenCalled();
  });

  it('6. handles zero matching results gracefully', async () => {
    (mockKeywordRetriever.search as any).mockResolvedValue([]);
    (mockVectorRetriever.search as any).mockResolvedValue([]);

    const res = await searchService.search({ query: 'no matches' });

    expect(res.results).toEqual([]);
    expect(res.pagination.total).toBe(0);
    expect(res.pagination.hasMore).toBe(false);
  });

  it('7. degrades gracefully when vector retriever rejects', async () => {
    (mockKeywordRetriever.search as any).mockResolvedValue([createDummyResult('kw-ok', 1, 'keyword')]);
    (mockVectorRetriever.search as any).mockRejectedValue(new Error('Embedding API Down'));

    const res = await searchService.search({ query: 'fault test', mode: 'HYBRID' });

    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('kw-ok');
    expect(res.degraded).toBe(true);
    expect(res.degradedReason).toContain('Vector retriever failed');
  });

  it('8. degrades gracefully when keyword retriever rejects', async () => {
    (mockKeywordRetriever.search as any).mockRejectedValue(new Error('DB Timeout'));
    (mockVectorRetriever.search as any).mockResolvedValue([createDummyResult('vec-ok', 1, 'vector')]);

    const res = await searchService.search({ query: 'fault test', mode: 'HYBRID' });

    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('vec-ok');
    expect(res.degraded).toBe(true);
    expect(res.degradedReason).toContain('Keyword retriever failed');
  });

  it('9. paginates post-fusion results accurately (first, middle, and beyond)', async () => {
    const kw = [
      createDummyResult('c1', 1, 'keyword'),
      createDummyResult('c2', 2, 'keyword'),
      createDummyResult('c3', 3, 'keyword'),
      createDummyResult('c4', 4, 'keyword'),
      createDummyResult('c5', 5, 'keyword'),
    ];
    (mockKeywordRetriever.search as any).mockResolvedValue(kw);
    (mockVectorRetriever.search as any).mockResolvedValue([]);

    // Page 1: limit 2
    const p1 = await searchService.search({ query: 'paging', mode: 'KEYWORD', page: 1, limit: 2 });
    expect(p1.results).toHaveLength(2);
    expect(p1.results[0].chunkId).toBe('c1');
    expect(p1.results[1].chunkId).toBe('c2');
    expect(p1.pagination.total).toBe(5);
    expect(p1.pagination.hasMore).toBe(true);

    // Page 2: limit 2
    const p2 = await searchService.search({ query: 'paging', mode: 'KEYWORD', page: 2, limit: 2 });
    expect(p2.results).toHaveLength(2);
    expect(p2.results[0].chunkId).toBe('c3');
    expect(p2.results[1].chunkId).toBe('c4');
    expect(p2.pagination.offset).toBe(2);
    expect(p2.pagination.hasMore).toBe(true);

    // Page 3: limit 2 (final partial page)
    const p3 = await searchService.search({ query: 'paging', mode: 'KEYWORD', page: 3, limit: 2 });
    expect(p3.results).toHaveLength(1);
    expect(p3.results[0].chunkId).toBe('c5');
    expect(p3.pagination.hasMore).toBe(false);

    // Page 10: beyond available results
    const p10 = await searchService.search({ query: 'paging', mode: 'KEYWORD', page: 10, limit: 2 });
    expect(p10.results).toHaveLength(0);
    expect(p10.pagination.hasMore).toBe(false);
    expect(p10.pagination.total).toBe(5);
  });

  it('10. safely clamps invalid pagination parameters', async () => {
    (mockKeywordRetriever.search as any).mockResolvedValue([]);
    (mockVectorRetriever.search as any).mockResolvedValue([]);

    const res = await searchService.search({
      query: 'clamp',
      page: -5,
      limit: 500,
    });

    expect(res.pagination.page).toBe(1);
    expect(res.pagination.limit).toBe(100);
  });

  it('11. forwards sourceId filter to underlying retrievers', async () => {
    (mockKeywordRetriever.search as any).mockResolvedValue([]);
    (mockVectorRetriever.search as any).mockResolvedValue([]);

    const sourceUuid = '11111111-2222-3333-4444-555555555555';
    await searchService.search({
      query: 'scoped',
      sourceId: sourceUuid,
    });

    expect(mockKeywordRetriever.search).toHaveBeenCalledWith('scoped', expect.any(Number), sourceUuid);
    expect(mockVectorRetriever.search).toHaveBeenCalledWith('scoped', expect.any(Number), sourceUuid);
  });

  function createDummyResult(
    id: string,
    rank: number,
    source: 'keyword' | 'vector',
    score: number = 0.5
  ): RankedSearchResult {
    return createDummyRanked(id, rank, source, score);
  }
});
