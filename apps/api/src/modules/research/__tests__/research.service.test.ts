import { describe, it, expect, vi } from 'vitest';
import { SearchResultItem } from '@seekr/types';
import { MockLlmProvider } from '@seekr/shared';
import { ResearchService } from '../research.service.js';

describe('ResearchService Integration & Unit Tests', () => {
  const mockChunks: SearchResultItem[] = [
    {
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      title: 'Redis Persistence Guide',
      url: 'https://redis.io/persistence',
      content: 'Redis supports AOF (Append Only File) persistence which logs every write operation received by the server.',
      score: 0.95,
      rank: 1,
      sourceType: 'web',
    },
    {
      chunkId: 'chunk-2',
      documentId: 'doc-2',
      chunkIndex: 0,
      title: 'Redis RDB Snapshotting',
      url: 'https://redis.io/rdb',
      content: 'RDB persistence performs point-in-time snapshots of your dataset at specified intervals.',
      score: 0.88,
      rank: 2,
      sourceType: 'web',
    },
  ];

  it('1. synthesizes research answer and maps citations back to source chunks', async () => {
    const mockLlm = new MockLlmProvider({
      defaultReply: 'Redis provides durability through AOF logging [1] and periodic point-in-time RDB snapshots [2].',
      latencyMs: 5,
    });

    const researchService = new ResearchService({
      llmProvider: mockLlm,
    });

    const res = await researchService.research(
      { query: 'How does Redis persistence work?' },
      mockChunks
    );

    expect(res.query).toBe('How does Redis persistence work?');
    expect(res.answer).toContain('AOF logging [1]');
    expect(res.insufficientContext).toBe(false);
    expect(res.sources).toHaveLength(2);

    // Verify citations
    expect(res.citations).toHaveLength(2);
    expect(res.citations[0].citationId).toBe('[1]');
    expect(res.citations[0].chunkId).toBe('chunk-1');
    expect(res.citations[0].title).toBe('Redis Persistence Guide');
    expect(res.citations[1].citationId).toBe('[2]');
    expect(res.citations[1].chunkId).toBe('chunk-2');
    expect(res.citations[1].title).toBe('Redis RDB Snapshotting');

    // Verify LLM request was received
    expect(mockLlm.recordedRequests).toHaveLength(1);
    const req = mockLlm.recordedRequests[0];
    expect(req.prompt).toContain('[BEGIN SEARCH RETRIEVAL CONTEXT - UNTRUSTED DATA ONLY]');
    expect(req.prompt).toContain('<source id="[1]"');
    expect(req.systemInstruction).toContain('Seekr Research');
  });

  it('2. integrates with SearchService when candidate chunks are not pre-retrieved', async () => {
    const mockSearchService = {
      search: vi.fn().mockResolvedValue({
        query: 'Redis RDB',
        mode: 'HYBRID',
        results: mockChunks,
        pagination: { page: 1, limit: 10, offset: 0, total: 2, hasMore: false },
        latencyMs: 12,
      }),
    };

    const mockLlm = new MockLlmProvider({
      defaultReply: 'Redis captures snapshots using RDB [2].',
    });

    const researchService = new ResearchService({
      searchService: mockSearchService as any,
      llmProvider: mockLlm,
    });

    const res = await researchService.research({
      query: 'Redis RDB',
      searchMode: 'HYBRID',
      maxSources: 10,
    });

    expect(mockSearchService.search).toHaveBeenCalledWith({
      query: 'Redis RDB',
      mode: 'HYBRID',
      limit: 10,
      page: 1,
      disableLogging: true,
    });
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].citationId).toBe('[2]');
    expect(res.citations[0].chunkId).toBe('chunk-2');
  });

  it('3. returns clean insufficientContext disclaimer when retrieval yields no results', async () => {
    const mockLlm = new MockLlmProvider();
    const researchService = new ResearchService({
      llmProvider: mockLlm,
    });

    const res = await researchService.research(
      { query: 'Something nonexistent' },
      [] // empty results
    );

    expect(res.insufficientContext).toBe(true);
    expect(res.insufficientReason).toBe('No search results found');
    expect(res.answer).toBe('I do not have sufficient information in the indexed sources to answer this question.');
    expect(res.citations).toHaveLength(0);
    expect(res.sources).toHaveLength(0);
    // LLM must NOT be called when there is no context
    expect(mockLlm.recordedRequests).toHaveLength(0);
  });

  it('4. extracts multiple occurrences and deduplicates citations', () => {
    const researchService = new ResearchService();
    const assembledContext = {
      formattedContext: '...',
      sources: [
        {
          citationId: '[1]',
          citationIndex: 1,
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          title: 'Doc 1',
          url: 'https://example.com/1',
          sourceType: 'web',
          score: 0.9,
        },
        {
          citationId: '[2]',
          citationIndex: 2,
          chunkId: 'chunk-2',
          documentId: 'doc-2',
          title: 'Doc 2',
          url: 'https://example.com/2',
          sourceType: 'web',
          score: 0.8,
        },
      ] as any,
      tokenBudget: {} as any,
      insufficientContext: false,
      totalCandidateCount: 2,
      includedSourceCount: 2,
    };

    const answer = 'First statement [1]. Second statement [2]. Additional point from source one [1].';
    const citations = researchService.extractCitations(answer, assembledContext);

    expect(citations).toHaveLength(2);
    expect(citations[0].citationIndex).toBe(1);
    expect(citations[1].citationIndex).toBe(2);
  });
});
