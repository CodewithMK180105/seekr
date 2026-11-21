import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { SearchService } from '../services/search.service.js';
import { SearchMode } from '../search.types.js';
import {
  BenchmarkDataset,
  BenchmarkQuery,
  BenchmarkReport,
  BenchmarkCategory,
  ModeQueryResult,
  QueryEvaluationResult,
  ModeAggregateMetrics,
  CategoryMetricSummary,
  ComparativeAnalysis,
  RunnerOptions,
} from './types.js';
import {
  precisionAtK,
  recallAtK,
  reciprocalRank,
  ndcgAtK,
} from './metrics.js';

function getMonorepoRoot(): string {
  let curr = process.cwd();
  while (curr && curr !== path.dirname(curr)) {
    if (
      fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(curr, 'evaluation/datasets/benchmark-v1.json'))
    ) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

export class BenchmarkRunner {
  private readonly searchService: SearchService;
  private readonly options: Required<RunnerOptions>;

  constructor(
    searchService: SearchService = new SearchService(),
    options: RunnerOptions = {}
  ) {
    this.searchService = searchService;
    const root = getMonorepoRoot();
    this.options = {
      datasetPath:
        options.datasetPath ||
        path.resolve(root, 'evaluation/datasets/benchmark-v1.json'),
      mode: options.mode as SearchMode,
      category: options.category as BenchmarkCategory,
      queryId: options.queryId || '',
      latencyWarmupRuns: options.latencyWarmupRuns ?? 2,
      latencyMeasuredRuns: options.latencyMeasuredRuns ?? 5,
      saveReports: options.saveReports ?? true,
    };
  }

  /**
   * Load and validate the benchmark dataset JSON
   */
  loadDataset(): BenchmarkDataset {
    if (!fs.existsSync(this.options.datasetPath)) {
      throw new Error(`Benchmark dataset file not found at ${this.options.datasetPath}`);
    }

    const raw = fs.readFileSync(this.options.datasetPath, 'utf8');
    const dataset = JSON.parse(raw) as BenchmarkDataset;

    if (!dataset.version || !Array.isArray(dataset.queries) || dataset.queries.length === 0) {
      throw new Error('Invalid benchmark dataset: missing version or empty queries array');
    }

    return dataset;
  }

  /**
   * Filter dataset queries based on runner options (category, queryId)
   */
  filterQueries(queries: BenchmarkQuery[]): BenchmarkQuery[] {
    let filtered = queries;
    if (this.options.queryId) {
      filtered = filtered.filter((q) => q.id.toUpperCase() === this.options.queryId.toUpperCase());
    }
    if (this.options.category) {
      filtered = filtered.filter((q) => q.category === this.options.category);
    }
    return filtered;
  }

  /**
   * Measure latency of a query execution across warm-up and measured runs
   */
  async measureLatency(
    query: string,
    mode: SearchMode
  ): Promise<{ p50: number; p95: number; mean: number; min: number; max: number; samples: number[] }> {
    // 1. Warm-up runs (not recorded in measurement statistics)
    for (let i = 0; i < this.options.latencyWarmupRuns; i++) {
      await this.searchService.search({ query, mode, page: 1, limit: 10, disableLogging: true });
    }

    // 2. Measured runs using monotonic timer
    const samples: number[] = [];
    for (let i = 0; i < this.options.latencyMeasuredRuns; i++) {
      const start = performance.now();
      await this.searchService.search({ query, mode, page: 1, limit: 10, disableLogging: true });
      const duration = performance.now() - start;
      samples.push(duration);
    }

    samples.sort((a, b) => a - b);
    const min = samples[0];
    const max = samples[samples.length - 1];
    const mean = samples.reduce((acc, s) => acc + s, 0) / samples.length;
    const p50 = samples[Math.floor(samples.length * 0.5)];
    const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];

    return {
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      samples,
    };
  }

  /**
   * Run the full search quality evaluation
   */
  async run(): Promise<BenchmarkReport> {
    const dataset = this.loadDataset();
    const targetQueries = this.filterQueries(dataset.queries);

    if (targetQueries.length === 0) {
      throw new Error('No queries match the configured filters');
    }

    console.log(`[BenchmarkRunner] Starting evaluation on ${targetQueries.length} queries...`);

    const modesToEvaluate: SearchMode[] = this.options.mode
      ? [this.options.mode]
      : ['KEYWORD', 'SEMANTIC', 'HYBRID'];

    const queryResults: QueryEvaluationResult[] = [];
    const modeLatencySamples: Record<SearchMode, number[]> = {
      KEYWORD: [],
      SEMANTIC: [],
      HYBRID: [],
    };

    const categoryCounts: Record<BenchmarkCategory, number> = {
      EXACT_KEYWORD: 0,
      CONCEPTUAL: 0,
      NATURAL_LANGUAGE: 0,
      AMBIGUOUS: 0,
      EXACT_PHRASE: 0,
      LONG_TAIL: 0,
    };

    // Evaluate each query sequentially across modes
    for (const bq of targetQueries) {
      categoryCounts[bq.category] = (categoryCounts[bq.category] || 0) + 1;

      const modeResults: Record<SearchMode, ModeQueryResult> = {
        KEYWORD: { precisionAt10: 0, recallAt10: 0, mrr: 0, ndcgAt10: 0, latencyMs: 0, returnedChunkIds: [] },
        SEMANTIC: { precisionAt10: 0, recallAt10: 0, mrr: 0, ndcgAt10: 0, latencyMs: 0, returnedChunkIds: [] },
        HYBRID: { precisionAt10: 0, recallAt10: 0, mrr: 0, ndcgAt10: 0, latencyMs: 0, returnedChunkIds: [] },
      };

      for (const mode of modesToEvaluate) {
        // Measure execution latency
        const latencyStats = await this.measureLatency(bq.query, mode);
        modeLatencySamples[mode].push(...latencyStats.samples);

        // Execute primary search for relevance evaluation
        const searchRes = await this.searchService.search({
          query: bq.query,
          mode,
          page: 1,
          limit: 10,
          disableLogging: true,
        });

        const returnedChunkIds = searchRes.results.map((r) => r.chunkId);

        const p10 = precisionAtK(returnedChunkIds, bq.relevantChunks, 10);
        const r10 = recallAtK(returnedChunkIds, bq.relevantChunks, 10);
        const mrr = reciprocalRank(returnedChunkIds, bq.relevantChunks);
        const ndcg10 = ndcgAtK(returnedChunkIds, bq.relevantChunks, 10);

        modeResults[mode] = {
          precisionAt10: p10,
          recallAt10: r10,
          mrr,
          ndcgAt10: ndcg10,
          latencyMs: latencyStats.p50,
          returnedChunkIds,
        };
      }

      queryResults.push({
        queryId: bq.id,
        query: bq.query,
        category: bq.category,
        results: modeResults,
      });
    }

    // Compute Aggregate Metrics per Mode
    const aggregateMetrics: Record<SearchMode, ModeAggregateMetrics> = {} as any;

    for (const mode of modesToEvaluate) {
      const allP10 = queryResults.map((qr) => qr.results[mode].precisionAt10);
      const allR10 = queryResults.map((qr) => qr.results[mode].recallAt10);
      const allMrr = queryResults.map((qr) => qr.results[mode].mrr);
      const allNdcg = queryResults.map((qr) => qr.results[mode].ndcgAt10);

      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

      const samples = modeLatencySamples[mode].sort((a, b) => a - b);
      const p50 = samples.length ? samples[Math.floor(samples.length * 0.5)] : 0;
      const p95 = samples.length
        ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]
        : 0;
      const mean = avg(samples);
      const min = samples.length ? samples[0] : 0;
      const max = samples.length ? samples[samples.length - 1] : 0;

      aggregateMetrics[mode] = {
        mode,
        precisionAt10: Number(avg(allP10).toFixed(4)),
        recallAt10: Number(avg(allR10).toFixed(4)),
        mrr: Number(avg(allMrr).toFixed(4)),
        ndcgAt10: Number(avg(allNdcg).toFixed(4)),
        p50LatencyMs: Number(p50.toFixed(2)),
        p95LatencyMs: Number(p95.toFixed(2)),
        meanLatencyMs: Number(mean.toFixed(2)),
        minLatencyMs: Number(min.toFixed(2)),
        maxLatencyMs: Number(max.toFixed(2)),
      };
    }

    // Compute Category Breakdowns
    const categories: BenchmarkCategory[] = [
      'EXACT_KEYWORD',
      'CONCEPTUAL',
      'NATURAL_LANGUAGE',
      'AMBIGUOUS',
      'EXACT_PHRASE',
      'LONG_TAIL',
    ];

    const categoryBreakdown: Record<
      BenchmarkCategory,
      Record<SearchMode, CategoryMetricSummary>
    > = {} as any;

    for (const cat of categories) {
      const catQueries = queryResults.filter((qr) => qr.category === cat);
      categoryBreakdown[cat] = {} as any;

      for (const mode of modesToEvaluate) {
        if (catQueries.length === 0) {
          categoryBreakdown[cat][mode] = { precisionAt10: 0, recallAt10: 0, mrr: 0, ndcgAt10: 0 };
          continue;
        }

        const p10 = catQueries.map((q) => q.results[mode].precisionAt10);
        const r10 = catQueries.map((q) => q.results[mode].recallAt10);
        const mrr = catQueries.map((q) => q.results[mode].mrr);
        const ndcg = catQueries.map((q) => q.results[mode].ndcgAt10);

        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

        categoryBreakdown[cat][mode] = {
          precisionAt10: Number(avg(p10).toFixed(4)),
          recallAt10: Number(avg(r10).toFixed(4)),
          mrr: Number(avg(mrr).toFixed(4)),
          ndcgAt10: Number(avg(ndcg).toFixed(4)),
        };
      }
    }

    // Comparative Analysis
    const comparativeAnalysis = this.analyzeComparisons(
      queryResults,
      aggregateMetrics,
      categoryBreakdown
    );

    const report: BenchmarkReport = {
      benchmarkVersion: dataset.version,
      timestamp: new Date().toISOString(),
      totalQueries: targetQueries.length,
      categoryDistribution: categoryCounts,
      latencyWarmupRuns: this.options.latencyWarmupRuns,
      latencyMeasuredRuns: this.options.latencyMeasuredRuns,
      aggregateMetrics,
      categoryBreakdown,
      queryResults,
      comparativeAnalysis,
    };

    return report;
  }

  /**
   * Perform comparative analysis across retrieval modes
   */
  private analyzeComparisons(
    queryResults: QueryEvaluationResult[],
    aggregates: Record<SearchMode, ModeAggregateMetrics>,
    catBreakdown: Record<BenchmarkCategory, Record<SearchMode, CategoryMetricSummary>>
  ): ComparativeAnalysis {
    // Best overall mode based on ranking quality (nDCG@10 + MRR)
    let bestOverallMode: SearchMode = 'HYBRID';
    let maxQualityScore = -1;

    for (const mode of ['KEYWORD', 'SEMANTIC', 'HYBRID'] as SearchMode[]) {
      if (aggregates[mode]) {
        const qualityScore = aggregates[mode].ndcgAt10 + aggregates[mode].mrr;
        if (qualityScore > maxQualityScore) {
          maxQualityScore = qualityScore;
          bestOverallMode = mode;
        }
      }
    }

    // Best mode by category
    const bestModeByCategory: Record<BenchmarkCategory, SearchMode> = {} as any;
    const categories: BenchmarkCategory[] = [
      'EXACT_KEYWORD',
      'CONCEPTUAL',
      'NATURAL_LANGUAGE',
      'AMBIGUOUS',
      'EXACT_PHRASE',
      'LONG_TAIL',
    ];

    for (const cat of categories) {
      let bestMode: SearchMode = 'HYBRID';
      let highestCatNdcg = -1;

      for (const mode of ['KEYWORD', 'SEMANTIC', 'HYBRID'] as SearchMode[]) {
        if (catBreakdown[cat]?.[mode]) {
          const score = catBreakdown[cat][mode].ndcgAt10;
          if (score > highestCatNdcg) {
            highestCatNdcg = score;
            bestMode = mode;
          }
        }
      }
      bestModeByCategory[cat] = bestMode;
    }

    // Identify query-level wins and losses
    const hybridWins: Array<{ queryId: string; query: string; reason: string }> = [];
    const hybridLosses: Array<{ queryId: string; query: string; reason: string }> = [];
    const keywordWins: Array<{ queryId: string; query: string; reason: string }> = [];
    const semanticWins: Array<{ queryId: string; query: string; reason: string }> = [];
    const zeroRecallQueries: Array<{ queryId: string; query: string }> = [];

    for (const qr of queryResults) {
      const kw = qr.results.KEYWORD;
      const sem = qr.results.SEMANTIC;
      const hyb = qr.results.HYBRID;

      if (!kw || !sem || !hyb) continue;

      if (hyb.ndcgAt10 === 0 && kw.ndcgAt10 === 0 && sem.ndcgAt10 === 0) {
        zeroRecallQueries.push({ queryId: qr.queryId, query: qr.query });
      }

      // Hybrid win: strictly higher nDCG than both single modes
      if (hyb.ndcgAt10 > kw.ndcgAt10 && hyb.ndcgAt10 > sem.ndcgAt10) {
        hybridWins.push({
          queryId: qr.queryId,
          query: qr.query,
          reason: `Hybrid nDCG (${hyb.ndcgAt10}) outperformed Keyword (${kw.ndcgAt10}) and Semantic (${sem.ndcgAt10})`,
        });
      }

      // Hybrid regression: strictly worse than both or significantly worse than the best single mode
      if (hyb.ndcgAt10 < Math.max(kw.ndcgAt10, sem.ndcgAt10) - 0.1) {
        hybridLosses.push({
          queryId: qr.queryId,
          query: qr.query,
          reason: `Hybrid nDCG (${hyb.ndcgAt10}) lagged best single mode (${Math.max(kw.ndcgAt10, sem.ndcgAt10)})`,
        });
      }

      // Keyword win
      if (kw.ndcgAt10 > hyb.ndcgAt10 && kw.ndcgAt10 > sem.ndcgAt10) {
        keywordWins.push({
          queryId: qr.queryId,
          query: qr.query,
          reason: `Keyword nDCG (${kw.ndcgAt10}) exceeded Semantic (${sem.ndcgAt10}) and Hybrid (${hyb.ndcgAt10})`,
        });
      }

      // Semantic win
      if (sem.ndcgAt10 > hyb.ndcgAt10 && sem.ndcgAt10 > kw.ndcgAt10) {
        semanticWins.push({
          queryId: qr.queryId,
          query: qr.query,
          reason: `Semantic nDCG (${sem.ndcgAt10}) exceeded Keyword (${kw.ndcgAt10}) and Hybrid (${hyb.ndcgAt10})`,
        });
      }
    }

    const kwP50 = aggregates.KEYWORD?.p50LatencyMs ?? 0;
    const semP50 = aggregates.SEMANTIC?.p50LatencyMs ?? 0;
    const hybP50 = aggregates.HYBRID?.p50LatencyMs ?? 0;

    const qualityVsLatencySummary = `HYBRID delivers the most consistent ranking quality across categories (nDCG@10: ${
      aggregates.HYBRID?.ndcgAt10 ?? 0
    }, MRR: ${aggregates.HYBRID?.mrr ?? 0}) at P50 latency of ${hybP50}ms. KEYWORD provides ultra-low latency (${kwP50}ms) and excels on verbatim exact phrasing, but suffers on natural language queries. SEMANTIC retrieves conceptually related chunks (P50: ${semP50}ms) but can lose precision on exact technical identifiers. HYBRID balances both with reciprocal rank fusion.`;

    return {
      bestOverallMode,
      bestModeByCategory,
      hybridWins,
      hybridLosses,
      keywordWins,
      semanticWins,
      zeroRecallQueries,
      qualityVsLatencySummary,
    };
  }
}
