import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService, applyMultiSignalReranking, deduplicateByDocument } from '../services/search.service.js';
import { searchSufficiencyService } from '../services/search-sufficiency.service.js';
import { queryUnderstandingService } from '../services/query-understanding.service.js';
import { SearchResultItem } from '@seekr/types';

describe('SearchSufficiencyService & Multi-Signal Ranking Tests', () => {
  it('1. triggers web discovery when local results are empty', () => {
    const parsed = queryUnderstandingService.parseQuery('CRISPR gene editing mechanism');
    const decision = searchSufficiencyService.evaluateSufficiency([], parsed);
    expect(decision.action).toBe('TRIGGER_WEB_DISCOVERY');
    expect(decision.targetDiscoveryCount).toBeGreaterThan(0);
  });

  it('2. immediately rejects gibberish and avoids triggering discovery', () => {
    const parsed = queryUnderstandingService.parseQuery('fttxtx');
    const decision = searchSufficiencyService.evaluateSufficiency([], parsed);
    expect(decision.action).toBe('REJECT_GIBBERISH');
    expect(decision.targetDiscoveryCount).toBe(0);
  });

  it('3. satisfies sufficiency immediately for high-confidence factual match', () => {
    const parsed = queryUnderstandingService.parseQuery('Who is Virat Kohli?');
    const mockResults: SearchResultItem[] = [
      {
        chunkId: 'c1',
        documentId: 'd1',
        chunkIndex: 0,
        title: 'Virat Kohli - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Virat_Kohli',
        content: 'Virat Kohli is an Indian international cricketer...',
        score: 0.92,
        rank: 1,
        sourceType: 'WEBSITE',
      },
    ];
    const decision = searchSufficiencyService.evaluateSufficiency(mockResults, parsed);
    expect(decision.action).toBe('SUFFICIENT_RETURN_LOCAL');
    expect(decision.targetDiscoveryCount).toBe(0);
  });

  it('4. triggers discovery for comparison query if local results lack multi-source depth', () => {
    const parsed = queryUnderstandingService.parseQuery('Redis RDB vs AOF difference');
    // Only 1 result available locally
    const mockResults: SearchResultItem[] = [
      {
        chunkId: 'c1',
        documentId: 'd1',
        chunkIndex: 0,
        title: 'Redis persistence',
        url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/persistence',
        content: 'Redis provides RDB and AOF persistence options...',
        score: 0.65,
        rank: 1,
        sourceType: 'DOCUMENTATION',
      },
    ];
    const decision = searchSufficiencyService.evaluateSufficiency(mockResults, parsed);
    expect(decision.action).toBe('TRIGGER_WEB_DISCOVERY');
    expect(decision.targetDiscoveryCount).toBeGreaterThanOrEqual(1);
  });

  it('5. boosts exact title and entity matches in multi-signal reranking', () => {
    const parsed = queryUnderstandingService.parseQuery('Redis persistence');
    const items: SearchResultItem[] = [
      {
        chunkId: 'c1',
        documentId: 'd1',
        chunkIndex: 0,
        title: 'General Database Concepts',
        url: 'https://example.com/db',
        content: 'Databases use write ahead logging and snapshots for durability.',
        score: 0.60,
        rank: 1,
        sourceType: 'DOCUMENTATION',
      },
      {
        chunkId: 'c2',
        documentId: 'd2',
        chunkIndex: 0,
        title: 'Redis persistence and data recovery',
        url: 'https://redis.io/persistence',
        content: 'Redis persistence allows storing data snapshots to disk.',
        score: 0.58,
        rank: 2,
        sourceType: 'DOCUMENTATION',
      },
    ];

    const reranked = applyMultiSignalReranking(items, parsed);
    // Item 2 should receive a title relevance boost and surpass Item 1
    expect(reranked[0].documentId).toBe('d2');
    expect(reranked[0].score).toBeGreaterThan(items[1].score);
  });

  it('6. deduplicates multiple chunks from the same document ID', () => {
    const items: SearchResultItem[] = [
      {
        chunkId: 'c1',
        documentId: 'doc-paris',
        chunkIndex: 0,
        title: 'Paris - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Paris',
        content: 'Paris is the capital of France...',
        score: 0.85,
        rank: 1,
        sourceType: 'WEBSITE',
      },
      {
        chunkId: 'c2',
        documentId: 'doc-paris',
        chunkIndex: 1,
        title: 'Paris - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Paris',
        content: 'The history of Paris dates back thousands of years...',
        score: 0.82,
        rank: 2,
        sourceType: 'WEBSITE',
      },
      {
        chunkId: 'c3',
        documentId: 'doc-tokyo',
        chunkIndex: 0,
        title: 'Tokyo - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Tokyo',
        content: 'Tokyo is the capital of Japan...',
        score: 0.70,
        rank: 3,
        sourceType: 'WEBSITE',
      },
    ];

    const deduplicated = deduplicateByDocument(items);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].documentId).toBe('doc-paris');
    expect(deduplicated[1].documentId).toBe('doc-tokyo');
  });

  it('7. dispatches progressive events during search execution', async () => {
    const mockKw = { name: 'keyword', search: vi.fn().mockResolvedValue([]) };
    const mockVec = { name: 'vector', search: vi.fn().mockResolvedValue([]) };
    const mockRrf = { fuse: vi.fn().mockReturnValue([]) };
    const mockLog = { logSearch: vi.fn().mockResolvedValue(undefined) } as any;
    const mockCache = { findMatch: vi.fn().mockResolvedValue({ matched: false }), store: vi.fn() } as any;
    const mockCrawler = {
      crawlForQuery: vi.fn().mockResolvedValue([
        {
          chunkId: 'c-crawled',
          documentId: 'doc-crawled',
          chunkIndex: 0,
          title: 'Quantum Computing Overview',
          url: 'https://example.com/quantum',
          content: 'Quantum computing uses qubits and superposition...',
          score: 0.80,
          rank: 1,
          sourceType: 'WEBSITE',
        },
      ]),
    } as any;

    const service = new SearchService(
      mockKw as any,
      mockVec as any,
      mockRrf as any,
      mockLog,
      mockCache,
      mockCrawler
    );

    const emittedEvents: any[] = [];
    const res = await service.search(
      { query: 'quantum computing', mode: 'HYBRID' },
      (evt) => emittedEvents.push(evt)
    );

    expect(res.results).toHaveLength(1);
    expect(res.dynamicallyCrawled).toBe(true);

    const phaseEvents = emittedEvents.filter((e) => e.type === 'PHASE');
    const localEvents = emittedEvents.filter((e) => e.type === 'LOCAL_RESULTS');
    const completeEvents = emittedEvents.filter((e) => e.type === 'COMPLETE');

    expect(phaseEvents.length).toBeGreaterThanOrEqual(1);
    expect(localEvents).toHaveLength(1);
    expect(completeEvents).toHaveLength(1);
  });
});
