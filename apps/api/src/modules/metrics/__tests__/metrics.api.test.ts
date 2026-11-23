import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { metricsRegistry } from '@seekr/shared';

describe('Prometheus Metrics & Observability API Integration Tests', () => {
  beforeAll(async () => {
    // Warm up some metrics
    await request(app).get('/health');
  });

  describe('GET /metrics - Prometheus Exposition Format', () => {
    it('returns 200 with text/plain; version=0.0.4 content type', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-type']).toContain('version=0.0.4');
      expect(typeof res.text).toBe('string');
      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('# TYPE');
    });

    it('exposes Prometheus metrics across core system components', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      const text = res.text;

      // 1. HTTP metrics
      expect(text).toContain('seekr_http_requests_total');
      expect(text).toContain('seekr_http_request_duration_seconds');

      // 2. Search metrics
      expect(text).toContain('seekr_search_requests_total');
      expect(text).toContain('seekr_search_duration_seconds');

      // 3. Research metrics
      expect(text).toContain('seekr_research_requests_total');
      expect(text).toContain('seekr_research_tokens_total');

      // 4. Cache metrics
      expect(text).toContain('seekr_cache_lookups_total');
      expect(text).toContain('seekr_cache_entries_active');
      expect(text).toContain('seekr_cache_hit_ratio');

      // 5. Rate limit metrics
      expect(text).toContain('seekr_rate_limit_exceeded_total');

      // 6. BullMQ Queue metrics
      expect(text).toContain('seekr_queue_jobs_waiting');
      expect(text).toContain('seekr_queue_jobs_active');

      // 7. Node.js runtime metrics
      expect(text).toContain('seekr_nodejs_heap_size_used_bytes');
      expect(text).toContain('seekr_process_cpu_user_seconds_total');
    });

    it('bypasses rate limiting for monitoring and scrape probes', async () => {
      // Fire 15 consecutive requests (well beyond default 10 req/min limits)
      for (let i = 0; i < 15; i++) {
        const res = await request(app).get('/metrics');
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-limit']).toBeUndefined();
      }
    });
  });

  describe('GET /metrics - Structured JSON Format Alternative', () => {
    it('returns structured JSON when format=json query parameter is present', async () => {
      const res = await request(app).get('/metrics?format=json');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const metricNames = res.body.data.map((m: any) => m.name);
      expect(metricNames).toContain('seekr_http_requests_total');
      expect(metricNames).toContain('seekr_search_requests_total');
    });

    it('returns structured JSON when Accept: application/json header is sent', async () => {
      const res = await request(app)
        .get('/metrics')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('End-to-End Pipeline Metric Increments', () => {
    it('increments search and HTTP metrics when calling search endpoint', async () => {
      // Call search
      await request(app).get('/api/v1/search?q=observability+integration+test&mode=HYBRID');

      const res = await request(app).get('/metrics?format=json');
      const metrics = res.body.data;

      const httpRequests = metrics.find((m: any) => m.name === 'seekr_http_requests_total');
      const searchRequests = metrics.find((m: any) => m.name === 'seekr_search_requests_total');

      expect(httpRequests).toBeDefined();
      expect(
        httpRequests.values.some(
          (v: any) => v.labels.route === '/api/v1/search' && v.value > 0
        )
      ).toBe(true);

      expect(searchRequests).toBeDefined();
      expect(
        searchRequests.values.some(
          (v: any) => v.labels.mode === 'HYBRID' && v.value > 0
        )
      ).toBe(true);
    });
  });
});
