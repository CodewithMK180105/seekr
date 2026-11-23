import { describe, it, expect } from 'vitest';
import {
  metricsRegistry,
  httpRequestsTotal,
  httpErrorsTotal,
  httpRequestDurationSeconds,
  searchRequestsTotal,
  searchDurationSeconds,
  researchRequestsTotal,
  researchTokensTotal,
  cacheLookupsTotal,
  cacheHitRatio,
  rateLimitExceededTotal,
  queueJobsWaiting,
  crawlerJobsProcessedTotal,
} from '../index.js';

describe('Metrics Registry & Metric Definitions Unit Tests', () => {
  it('registers all core Seekr metrics with the centralized registry', async () => {
    const registeredMetrics = await metricsRegistry.getMetricsAsJSON();
    const metricNames = registeredMetrics.map((m) => m.name);

    // Verify key metrics exist in registry
    expect(metricNames).toContain('seekr_http_requests_total');
    expect(metricNames).toContain('seekr_http_errors_total');
    expect(metricNames).toContain('seekr_http_request_duration_seconds');
    expect(metricNames).toContain('seekr_search_requests_total');
    expect(metricNames).toContain('seekr_search_duration_seconds');
    expect(metricNames).toContain('seekr_research_requests_total');
    expect(metricNames).toContain('seekr_research_tokens_total');
    expect(metricNames).toContain('seekr_cache_lookups_total');
    expect(metricNames).toContain('seekr_cache_hit_ratio');
    expect(metricNames).toContain('seekr_rate_limit_exceeded_total');
    expect(metricNames).toContain('seekr_queue_jobs_waiting');
    expect(metricNames).toContain('seekr_crawler_jobs_processed_total');
  });

  it('includes default Node.js runtime and process metrics with seekr_ prefix', async () => {
    const registeredMetrics = await metricsRegistry.getMetricsAsJSON();
    const metricNames = registeredMetrics.map((m) => m.name);

    expect(metricNames.some((n) => n.startsWith('seekr_process_cpu_'))).toBe(true);
    expect(metricNames.some((n) => n.startsWith('seekr_nodejs_heap_size_'))).toBe(true);
    expect(metricNames.some((n) => n.startsWith('seekr_nodejs_eventloop_lag_'))).toBe(true);
  });

  it('correctly increments counters with required labels', async () => {
    searchRequestsTotal.inc({ mode: 'HYBRID', status: 'success' }, 3);
    rateLimitExceededTotal.inc({ category: 'search' }, 2);

    const json = await metricsRegistry.getMetricsAsJSON();
    const searchMetric = json.find((m) => m.name === 'seekr_search_requests_total');
    const rateLimitMetric = json.find((m) => m.name === 'seekr_rate_limit_exceeded_total');

    expect(searchMetric).toBeDefined();
    expect(searchMetric?.values.some((v) => v.labels.mode === 'HYBRID' && v.value >= 3)).toBe(true);

    expect(rateLimitMetric).toBeDefined();
    expect(rateLimitMetric?.values.some((v) => v.labels.category === 'search' && v.value >= 2)).toBe(true);
  });

  it('records histogram observations and bucket distributions', async () => {
    searchDurationSeconds.observe({ mode: 'KEYWORD' }, 0.045);
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/search', status_code: '200' }, 0.015);

    const textOutput = await metricsRegistry.metrics();
    expect(textOutput).toContain('# TYPE seekr_search_duration_seconds histogram');
    expect(textOutput).toContain('seekr_search_duration_seconds_bucket{le=');
    expect(textOutput).toContain('# TYPE seekr_http_request_duration_seconds histogram');
  });

  it('serializes Prometheus exposition format matching text/plain; version=0.0.4 specifications', async () => {
    const textOutput = await metricsRegistry.metrics();

    expect(typeof textOutput).toBe('string');
    expect(textOutput).toContain('# HELP seekr_http_requests_total');
    expect(textOutput).toContain('# TYPE seekr_http_requests_total counter');
    expect(textOutput).toContain('# HELP seekr_research_requests_total');
    expect(textOutput).toContain('# TYPE seekr_research_requests_total counter');
  });
});
