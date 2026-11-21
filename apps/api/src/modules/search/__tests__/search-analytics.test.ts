import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchAnalyticsService } from '../services/search-analytics.service.js';

describe('SearchAnalyticsService Unit Tests', () => {
  let mockPrisma: any;
  let service: SearchAnalyticsService;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn(),
    };
    service = new SearchAnalyticsService(mockPrisma);
  });

  it('1. computes all summary metrics, percentiles, and CTR correctly', async () => {
    // 1. Overview mock
    const overviewData = [
      {
        totalQueries: 100,
        avgLatencyMs: 45.321,
        p50LatencyMs: 38.0,
        p95LatencyMs: 82.5,
        keywordCount: 30,
        semanticCount: 20,
        hybridCount: 50,
        zeroResultCount: 5,
      },
    ];

    // 2. CTR mock (25 searches had clicks out of 100 total searches, 40 clicks out of 400 impressions)
    const ctrData = [
      {
        totalImpressions: 400,
        totalClicks: 40,
        clickedSearches: 25,
      },
    ];

    // 3. Top queries mock
    const topQueriesData = [
      { query: 'redis clustering', count: 25 },
      { query: 'postgresql pgvector', count: 18 },
    ];

    // 4. Zero result queries mock
    const zeroResultData = [{ query: 'unindexed topic', count: 3 }];

    // 5. Top clicked documents mock
    const topClickedData = [
      {
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        title: 'Redis Documentation',
        url: 'https://redis.io/docs',
        clicks: 30,
      },
    ];

    mockPrisma.$queryRaw
      .mockResolvedValueOnce(overviewData)
      .mockResolvedValueOnce(ctrData)
      .mockResolvedValueOnce(topQueriesData)
      .mockResolvedValueOnce(zeroResultData)
      .mockResolvedValueOnce(topClickedData);

    const analytics = await service.getAnalytics();

    expect(analytics.totalQueries).toBe(100);
    expect(analytics.avgLatencyMs).toBe(45.32);
    expect(analytics.p50LatencyMs).toBe(38);
    expect(analytics.p95LatencyMs).toBe(82.5);

    // Search CTR: (25 / 100) * 100 = 25%
    expect(analytics.searchCtr).toBe(25);
    expect(analytics.clickThroughRate).toBe(25);

    // Result CTR: (40 / 400) * 100 = 10%
    expect(analytics.resultCtr).toBe(10);

    // Search Mode Distribution
    expect(analytics.modeDistribution).toEqual({
      HYBRID: 50,
      KEYWORD: 30,
      SEMANTIC: 20,
    });
    expect(analytics.searchModeDistribution).toEqual([
      { mode: 'HYBRID', count: 50, percentage: 50 },
      { mode: 'KEYWORD', count: 30, percentage: 30 },
      { mode: 'SEMANTIC', count: 20, percentage: 20 },
    ]);

    expect(analytics.topQueries).toEqual(topQueriesData);
    expect(analytics.zeroResultQueries).toEqual(zeroResultData);
    expect(analytics.topClickedDocuments).toEqual(topClickedData);
  });

  it('2. safely handles empty datasets without division by zero', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          totalQueries: 0,
          avgLatencyMs: 0,
          p50LatencyMs: 0,
          p95LatencyMs: 0,
          keywordCount: 0,
          semanticCount: 0,
          hybridCount: 0,
          zeroResultCount: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          totalImpressions: 0,
          totalClicks: 0,
          clickedSearches: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const analytics = await service.getAnalytics();

    expect(analytics.totalQueries).toBe(0);
    expect(analytics.avgLatencyMs).toBe(0);
    expect(analytics.searchCtr).toBe(0);
    expect(analytics.resultCtr).toBe(0);
    expect(analytics.searchModeDistribution[0].percentage).toBe(0);
    expect(analytics.topQueries).toEqual([]);
    expect(analytics.zeroResultQueries).toEqual([]);
  });

  it('3. respects from and to date filter parameters', async () => {
    const from = new Date('2026-11-01T00:00:00.000Z');
    const to = new Date('2026-11-20T23:59:59.000Z');

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ totalQueries: 5, avgLatencyMs: 12, p50LatencyMs: 10, p95LatencyMs: 20 }])
      .mockResolvedValueOnce([{ totalImpressions: 20, totalClicks: 2, clickedSearches: 2 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const analytics = await service.getAnalytics({ from, to });

    expect(analytics.period).toEqual({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    expect(analytics.totalQueries).toBe(5);
  });
});
