import { SearchMode } from '../search.types.js';

export type BenchmarkCategory =
  | 'EXACT_KEYWORD'
  | 'CONCEPTUAL'
  | 'NATURAL_LANGUAGE'
  | 'AMBIGUOUS'
  | 'EXACT_PHRASE'
  | 'LONG_TAIL';

export type RelevanceGrade = 0 | 1 | 2 | 3;

export interface BenchmarkGroundTruthItem {
  chunkId: string;
  relevance: RelevanceGrade;
}

export interface BenchmarkQuery {
  id: string;
  query: string;
  category: BenchmarkCategory;
  relevantChunks: BenchmarkGroundTruthItem[];
}

export interface BenchmarkDataset {
  version: string;
  description: string;
  createdAt: string;
  queries: BenchmarkQuery[];
}

export interface EvaluationMetrics {
  precisionAt10: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
  latencyMs: number;
}

export interface ModeQueryResult extends EvaluationMetrics {
  returnedChunkIds: string[];
}

export interface QueryEvaluationResult {
  queryId: string;
  query: string;
  category: BenchmarkCategory;
  results: Record<SearchMode, ModeQueryResult>;
}

export interface ModeAggregateMetrics {
  mode: SearchMode;
  precisionAt10: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  meanLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

export interface CategoryMetricSummary {
  precisionAt10: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
}

export interface ComparativeAnalysis {
  bestOverallMode: SearchMode;
  bestModeByCategory: Record<BenchmarkCategory, SearchMode>;
  hybridWins: Array<{ queryId: string; query: string; reason: string }>;
  hybridLosses: Array<{ queryId: string; query: string; reason: string }>;
  keywordWins: Array<{ queryId: string; query: string; reason: string }>;
  semanticWins: Array<{ queryId: string; query: string; reason: string }>;
  zeroRecallQueries: Array<{ queryId: string; query: string }>;
  qualityVsLatencySummary: string;
}

export interface BenchmarkReport {
  benchmarkVersion: string;
  timestamp: string;
  totalQueries: number;
  categoryDistribution: Record<BenchmarkCategory, number>;
  latencyWarmupRuns: number;
  latencyMeasuredRuns: number;
  aggregateMetrics: Record<SearchMode, ModeAggregateMetrics>;
  categoryBreakdown: Record<BenchmarkCategory, Record<SearchMode, CategoryMetricSummary>>;
  queryResults: QueryEvaluationResult[];
  comparativeAnalysis: ComparativeAnalysis;
}

export interface RunnerOptions {
  datasetPath?: string;
  mode?: SearchMode;
  category?: BenchmarkCategory;
  queryId?: string;
  latencyWarmupRuns?: number;
  latencyMeasuredRuns?: number;
  saveReports?: boolean;
}
