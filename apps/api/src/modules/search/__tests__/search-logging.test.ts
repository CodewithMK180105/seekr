import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchLoggingService, SearchLogEvent } from '../services/search-logging.service.js';

describe('SearchLoggingService Unit Tests', () => {
  let mockPrisma: any;
  let service: SearchLoggingService;

  beforeEach(() => {
    mockPrisma = {
      searchQuery: {
        create: vi.fn(),
      },
    };
    service = new SearchLoggingService(mockPrisma);
  });

  it('1. ignores empty or whitespace queries', async () => {
    await service.logSearch({
      searchQueryId: '123e4567-e89b-12d3-a456-426614174000',
      query: '   ',
      searchMode: 'HYBRID',
      resultCount: 0,
      latencyMs: 15,
      page: 1,
      limit: 10,
    });

    expect(mockPrisma.searchQuery.create).not.toHaveBeenCalled();
  });

  it('2. persists searchQuery record with normalized query and nested search_results', async () => {
    mockPrisma.searchQuery.create.mockResolvedValue({});

    const event: SearchLogEvent = {
      searchQueryId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '223e4567-e89b-12d3-a456-426614174001',
      sessionId: 'sess-abc-123',
      query: '  Redis Cluster Architecture  ',
      searchMode: 'HYBRID',
      resultCount: 2,
      latencyMs: 42.6,
      page: 1,
      limit: 10,
      results: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          title: 'Cluster Spec',
          url: 'https://redis.io/topics/cluster-spec',
          content: 'Redis cluster specification...',
          score: 0.85,
          rank: 1,
          sourceType: 'DOCUMENTATION',
        },
        {
          chunkId: 'chunk-2',
          documentId: 'doc-1',
          chunkIndex: 1,
          title: 'Cluster Tutorial',
          url: 'https://redis.io/topics/cluster-tutorial',
          content: 'Cluster tutorial content...',
          score: 0.72,
          rank: 2,
          sourceType: 'DOCUMENTATION',
        },
      ],
    };

    await service.logSearch(event);

    expect(mockPrisma.searchQuery.create).toHaveBeenCalledTimes(1);
    const callArg = mockPrisma.searchQuery.create.mock.calls[0][0];

    expect(callArg.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(callArg.data.userId).toBe('223e4567-e89b-12d3-a456-426614174001');
    expect(callArg.data.sessionId).toBe('sess-abc-123');
    expect(callArg.data.query).toBe('Redis Cluster Architecture');
    expect(callArg.data.normalizedQuery).toBe('redis cluster architecture');
    expect(callArg.data.latencyMs).toBe(43);
    expect(callArg.data.results.createMany.data).toEqual([
      {
        chunkId: 'chunk-1',
        resultRank: 1,
        fusedScore: 0.85,
        clicked: false,
      },
      {
        chunkId: 'chunk-2',
        resultRank: 2,
        fusedScore: 0.72,
        clicked: false,
      },
    ]);
  });

  it('3. limits logged results to maximum 10 items', async () => {
    mockPrisma.searchQuery.create.mockResolvedValue({});

    const manyResults = Array.from({ length: 25 }, (_, i) => ({
      chunkId: `chunk-${i}`,
      documentId: 'doc-1',
      chunkIndex: i,
      title: `Doc Title ${i}`,
      url: `https://example.com/${i}`,
      content: `Content ${i}`,
      score: 1 / (i + 1),
      rank: i + 1,
      sourceType: 'WEBSITE',
    }));

    await service.logSearch({
      searchQueryId: '123e4567-e89b-12d3-a456-426614174000',
      query: 'many items',
      searchMode: 'KEYWORD',
      resultCount: 25,
      latencyMs: 10,
      page: 1,
      limit: 20,
      results: manyResults,
    });

    const callArg = mockPrisma.searchQuery.create.mock.calls[0][0];
    expect(callArg.data.results.createMany.data).toHaveLength(10);
  });

  it('4. never throws or rejects when database insertion fails', async () => {
    mockPrisma.searchQuery.create.mockRejectedValue(new Error('PostgreSQL connection dropped'));

    await expect(
      service.logSearch({
        searchQueryId: '123e4567-e89b-12d3-a456-426614174000',
        query: 'safe error handling',
        searchMode: 'SEMANTIC',
        resultCount: 0,
        latencyMs: 5,
        page: 1,
        limit: 10,
      })
    ).resolves.toBeUndefined();
  });
});
