import { Counter, Gauge, Histogram } from 'prom-client';
import { metricsRegistry } from './registry.js';

// ============================================================================
// 1. HTTP & API Traffic Metrics
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'seekr_http_requests_total',
  help: 'Total number of HTTP requests processed by Seekr API',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpErrorsTotal = new Counter({
  name: 'seekr_http_errors_total',
  help: 'Total number of HTTP error responses (4xx and 5xx)',
  labelNames: ['method', 'route', 'status_code', 'error_type'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'seekr_http_request_duration_seconds',
  help: 'HTTP request latency duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// ============================================================================
// 2. Search & Retrieval Pipeline Metrics
// ============================================================================

export const searchRequestsTotal = new Counter({
  name: 'seekr_search_requests_total',
  help: 'Total number of search requests processed',
  labelNames: ['mode', 'status'] as const, // mode: KEYWORD | SEMANTIC | HYBRID; status: success | error
  registers: [metricsRegistry],
});

export const searchZeroResultsTotal = new Counter({
  name: 'seekr_search_zero_results_total',
  help: 'Total number of search requests that yielded zero results',
  labelNames: ['mode'] as const,
  registers: [metricsRegistry],
});

export const searchFailuresTotal = new Counter({
  name: 'seekr_search_failures_total',
  help: 'Total number of search requests that failed or encountered partial retriever errors',
  labelNames: ['mode', 'reason'] as const,
  registers: [metricsRegistry],
});

export const searchDurationSeconds = new Histogram({
  name: 'seekr_search_duration_seconds',
  help: 'Total end-to-end search request duration in seconds',
  labelNames: ['mode'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const retrievalDurationSeconds = new Histogram({
  name: 'seekr_retrieval_duration_seconds',
  help: 'Component-level retriever execution duration in seconds',
  labelNames: ['retriever'] as const, // 'keyword' | 'vector'
  buckets: [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry],
});

// ============================================================================
// 3. Research & LLM Synthesis Metrics
// ============================================================================

export const researchRequestsTotal = new Counter({
  name: 'seekr_research_requests_total',
  help: 'Total number of RAG research synthesis requests',
  labelNames: ['mode', 'status'] as const,
  registers: [metricsRegistry],
});

export const researchTokensTotal = new Counter({
  name: 'seekr_research_tokens_total',
  help: 'Total number of tokens consumed during research LLM synthesis',
  labelNames: ['token_type', 'provider', 'model'] as const, // token_type: prompt | completion | total
  registers: [metricsRegistry],
});

export const researchStreamingRequestsTotal = new Counter({
  name: 'seekr_research_streaming_requests_total',
  help: 'Total number of Server-Sent Events (SSE) streaming research requests initiated',
  registers: [metricsRegistry],
});

export const researchStreamingOutcomesTotal = new Counter({
  name: 'seekr_research_streaming_outcomes_total',
  help: 'Final outcomes of streaming research connections',
  labelNames: ['outcome'] as const, // completed | client_abort | error
  registers: [metricsRegistry],
});

export const researchDurationSeconds = new Histogram({
  name: 'seekr_research_duration_seconds',
  help: 'Total end-to-end research synthesis duration in seconds',
  labelNames: ['mode'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 20, 30],
  registers: [metricsRegistry],
});

export const llmGenerationDurationSeconds = new Histogram({
  name: 'seekr_llm_generation_duration_seconds',
  help: 'Pure LLM inference generation latency in seconds',
  labelNames: ['provider', 'model'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 20, 30],
  registers: [metricsRegistry],
});

export const researchCitationsPerSession = new Histogram({
  name: 'seekr_research_citations_per_session',
  help: 'Number of verified citations extracted per research session',
  buckets: [0, 1, 2, 3, 5, 8, 12, 20],
  registers: [metricsRegistry],
});

// ============================================================================
// 4. Multi-Tier Cache Metrics
// ============================================================================

export const cacheLookupsTotal = new Counter({
  name: 'seekr_cache_lookups_total',
  help: 'Total cache lookups across exact and semantic tiers',
  labelNames: ['tier', 'cache_type', 'result'] as const, // tier: exact | semantic; cache_type: search | research; result: hit | miss
  registers: [metricsRegistry],
});

export const cacheEntriesActive = new Gauge({
  name: 'seekr_cache_entries_active',
  help: 'Number of active non-expired entries in cache storage',
  labelNames: ['cache_type'] as const, // exact | semantic | embeddings
  registers: [metricsRegistry],
});

export const cacheHitRatio = new Gauge({
  name: 'seekr_cache_hit_ratio',
  help: 'Current cache hit ratio (0.0 to 1.0) by tier',
  labelNames: ['tier'] as const, // exact | semantic | total
  registers: [metricsRegistry],
});

export const cacheLookupDurationSeconds = new Histogram({
  name: 'seekr_cache_lookup_duration_seconds',
  help: 'Cache lookup evaluation latency in seconds',
  labelNames: ['tier'] as const, // exact | semantic
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

// ============================================================================
// 5. Rate Limiting Metrics
// ============================================================================

export const rateLimitExceededTotal = new Counter({
  name: 'seekr_rate_limit_exceeded_total',
  help: 'Total number of rate limit violations (HTTP 429) enforced',
  labelNames: ['category'] as const, // search | research | suggestions | global
  registers: [metricsRegistry],
});

// ============================================================================
// 6. BullMQ Queue & Worker Metrics
// ============================================================================

export const queueJobsWaiting = new Gauge({
  name: 'seekr_queue_jobs_waiting',
  help: 'Number of jobs currently waiting in BullMQ queue',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

export const queueJobsActive = new Gauge({
  name: 'seekr_queue_jobs_active',
  help: 'Number of jobs currently active in BullMQ worker',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

export const queueJobsCompleted = new Gauge({
  name: 'seekr_queue_jobs_completed',
  help: 'Number of successfully completed jobs in BullMQ queue',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

export const queueJobsFailed = new Gauge({
  name: 'seekr_queue_jobs_failed',
  help: 'Number of failed jobs in BullMQ queue',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

export const queueJobsDelayed = new Gauge({
  name: 'seekr_queue_jobs_delayed',
  help: 'Number of delayed/retry jobs in BullMQ queue',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

export const queuePaused = new Gauge({
  name: 'seekr_queue_paused',
  help: 'Indicates whether the BullMQ queue is currently paused (1 = paused, 0 = active)',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

export const crawlerJobsProcessedTotal = new Counter({
  name: 'seekr_crawler_jobs_processed_total',
  help: 'Total number of web crawling jobs processed by workers',
  labelNames: ['status'] as const, // completed | failed
  registers: [metricsRegistry],
});

export const crawlerJobDurationSeconds = new Histogram({
  name: 'seekr_crawler_job_duration_seconds',
  help: 'Execution duration of crawler jobs in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});
