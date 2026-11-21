import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BenchmarkRunner } from '../benchmark-runner.js';
import { BenchmarkReporter } from '../reporter.js';
import { BenchmarkDataset, BenchmarkQuery } from '../types.js';
import path from 'node:path';
import fs from 'node:fs';

describe('BenchmarkRunner & Reporter Unit Tests', () => {
  const mockDataset: BenchmarkDataset = {
    version: '1.0.0-test',
    description: 'Test evaluation dataset',
    createdAt: new Date().toISOString(),
    queries: [
      {
        id: 'Q001',
        query: 'redis persistence',
        category: 'EXACT_KEYWORD',
        relevantChunks: [
          { chunkId: 'c1', relevance: 3 },
          { chunkId: 'c2', relevance: 2 },
        ],
      },
      {
        id: 'Q002',
        query: 'how to formalize computability',
        category: 'CONCEPTUAL',
        relevantChunks: [
          { chunkId: 'c3', relevance: 3 },
        ],
      },
    ],
  };

  let mockSearchService: any;

  beforeEach(() => {
    mockSearchService = {
      search: vi.fn(),
    };
  });

  it('1. filters queries accurately by category or queryId', () => {
    const runner = new BenchmarkRunner(mockSearchService, {
      category: 'CONCEPTUAL',
    });

    const filtered = runner.filterQueries(mockDataset.queries);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('Q002');

    const runnerById = new BenchmarkRunner(mockSearchService, {
      queryId: 'q001',
    });
    const filteredById = runnerById.filterQueries(mockDataset.queries);
    expect(filteredById).toHaveLength(1);
    expect(filteredById[0].id).toBe('Q001');
  });

  it('2. executes benchmark runs, calculates metrics, and aggregates per mode', async () => {
    // Mock SearchService returns c1, c2, c3 for Q001 and c3 for Q002
    mockSearchService.search.mockImplementation(async (params: any) => {
      if (params.query === 'redis persistence') {
        return {
          query: params.query,
          mode: params.mode,
          results: [
            { chunkId: 'c1', rank: 1 },
            { chunkId: 'c2', rank: 2 },
            { chunkId: 'unrelated', rank: 3 },
          ],
          pagination: { total: 3 },
          latencyMs: 15,
        };
      }
      return {
        query: params.query,
        mode: params.mode,
        results: [
          { chunkId: 'c3', rank: 1 },
        ],
        pagination: { total: 1 },
        latencyMs: 25,
      };
    });

    const runner = new BenchmarkRunner(mockSearchService, {
      latencyWarmupRuns: 0,
      latencyMeasuredRuns: 1,
    });

    // Mock loadDataset to return mockDataset
    vi.spyOn(runner, 'loadDataset').mockReturnValue(mockDataset);

    const report = await runner.run();

    expect(report.totalQueries).toBe(2);
    expect(report.aggregateMetrics.HYBRID).toBeDefined();
    expect(report.aggregateMetrics.KEYWORD).toBeDefined();
    expect(report.aggregateMetrics.SEMANTIC).toBeDefined();

    // Check Q001 metrics for HYBRID
    // 2 relevant retrieved out of 10 -> precision@10 = 2 / 10 = 0.2
    // 2 relevant retrieved out of 2 known relevant -> recall@10 = 1.0
    // rank 1 is relevant -> MRR = 1.0
    const q1Res = report.queryResults.find((q) => q.queryId === 'Q001');
    expect(q1Res?.results.HYBRID.precisionAt10).toBe(0.2);
    expect(q1Res?.results.HYBRID.recallAt10).toBe(1.0);
    expect(q1Res?.results.HYBRID.mrr).toBe(1.0);
    expect(q1Res?.results.HYBRID.ndcgAt10).toBe(1.0);

    expect(report.comparativeAnalysis.bestOverallMode).toBeDefined();
    expect(report.comparativeAnalysis.bestModeByCategory.EXACT_KEYWORD).toBeDefined();
  });

  it('3. generates clean Markdown reports containing summary table and breakdowns', () => {
    const reporter = new BenchmarkReporter('/tmp');

    const sampleReport: any = {
      benchmarkVersion: '1.0.0',
      timestamp: '2026-11-21T10:00:00.000Z',
      totalQueries: 2,
      latencyWarmupRuns: 1,
      latencyMeasuredRuns: 2,
      aggregateMetrics: {
        KEYWORD: { precisionAt10: 0.15, recallAt10: 0.7, mrr: 0.8, ndcgAt10: 0.75, p50LatencyMs: 20, p95LatencyMs: 35, meanLatencyMs: 22 },
        SEMANTIC: { precisionAt10: 0.18, recallAt10: 0.8, mrr: 0.9, ndcgAt10: 0.82, p50LatencyMs: 50, p95LatencyMs: 80, meanLatencyMs: 55 },
        HYBRID: { precisionAt10: 0.20, recallAt10: 0.9, mrr: 1.0, ndcgAt10: 0.90, p50LatencyMs: 55, p95LatencyMs: 90, meanLatencyMs: 60 },
      },
      categoryDistribution: {
        EXACT_KEYWORD: 1,
        CONCEPTUAL: 1,
      },
      categoryBreakdown: {
        EXACT_KEYWORD: {
          KEYWORD: { ndcgAt10: 0.9 },
          SEMANTIC: { ndcgAt10: 0.7 },
          HYBRID: { ndcgAt10: 0.95 },
        },
        CONCEPTUAL: {
          KEYWORD: { ndcgAt10: 0.6 },
          SEMANTIC: { ndcgAt10: 0.9 },
          HYBRID: { ndcgAt10: 0.92 },
        },
      },
      queryResults: [],
      comparativeAnalysis: {
        bestOverallMode: 'HYBRID',
        bestModeByCategory: {
          EXACT_KEYWORD: 'HYBRID',
          CONCEPTUAL: 'HYBRID',
        },
        hybridWins: [],
        hybridLosses: [],
        keywordWins: [],
        semanticWins: [],
        zeroRecallQueries: [],
        qualityVsLatencySummary: 'HYBRID delivers superior nDCG at acceptable latency.',
      },
    };

    const md = reporter.generateMarkdown(sampleReport);

    expect(md).toContain('# Seekr Search Quality Benchmark Report');
    expect(md).toContain('| Metric | KEYWORD | SEMANTIC | HYBRID | Best Mode |');
    expect(md).toContain('HYBRID');
    expect(md).toContain('HYBRID delivers superior nDCG at acceptable latency.');
  });
});
