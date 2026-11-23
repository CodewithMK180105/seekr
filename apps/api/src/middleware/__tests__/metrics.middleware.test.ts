import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { normalizeRoute, httpMetricsMiddleware } from '../metrics.js';
import { metricsRegistry, httpRequestsTotal, httpErrorsTotal } from '@seekr/shared';

describe('HTTP Metrics Middleware & Route Normalizer Unit Tests', () => {
  describe('normalizeRoute()', () => {
    it('normalizes UUID path parameters to :id to prevent high cardinality', () => {
      const req = {
        originalUrl: '/api/v1/research/860bf7dc-578b-449a-8806-738976199ce2',
      } as Request;
      expect(normalizeRoute(req)).toBe('/api/v1/research/:id');
    });

    it('normalizes nested resource paths with UUIDs', () => {
      const req = {
        originalUrl: '/api/v1/research/860bf7dc-578b-449a-8806-738976199ce2/sources',
      } as Request;
      expect(normalizeRoute(req)).toBe('/api/v1/research/:id/sources');
    });

    it('strips query strings and trailing slashes completely', () => {
      const req = {
        originalUrl: '/api/v1/search?q=redis+persistence&mode=HYBRID&page=1',
      } as Request;
      expect(normalizeRoute(req)).toBe('/api/v1/search');

      const reqTrailing = {
        originalUrl: '/api/v1/cache/stats/',
      } as Request;
      expect(normalizeRoute(reqTrailing)).toBe('/api/v1/cache/stats');
    });

    it('prefers Express matched req.route.path when available', () => {
      const req = {
        baseUrl: '/api/v1/search',
        route: { path: '/:id' },
        originalUrl: '/api/v1/search/some-custom-id',
      } as any;
      expect(normalizeRoute(req)).toBe('/api/v1/search/:id');
    });
  });

  describe('httpMetricsMiddleware', () => {
    it('captures successful HTTP request and records method, route, and status code', async () => {
      const app = express();
      app.use(httpMetricsMiddleware);
      app.get('/test/metric-ping', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/test/metric-ping');
      expect(res.status).toBe(200);

      const metricsJson = await metricsRegistry.getMetricsAsJSON();
      const httpReqs = metricsJson.find((m) => m.name === 'seekr_http_requests_total');

      expect(httpReqs).toBeDefined();
      expect(
        httpReqs?.values.some(
          (v) =>
            v.labels.method === 'GET' &&
            v.labels.route === '/test/metric-ping' &&
            v.labels.status_code === '200'
        )
      ).toBe(true);
    });

    it('captures error responses (4xx and 5xx) and tracks error_type label', async () => {
      const app = express();
      app.use(httpMetricsMiddleware);
      app.get('/test/client-err', (_req, res) => res.status(404).json({ error: 'not found' }));
      app.get('/test/server-err', (_req, res) => res.status(500).json({ error: 'server fault' }));

      await request(app).get('/test/client-err');
      await request(app).get('/test/server-err');

      const metricsJson = await metricsRegistry.getMetricsAsJSON();
      const httpErrors = metricsJson.find((m) => m.name === 'seekr_http_errors_total');

      expect(httpErrors).toBeDefined();
      expect(
        httpErrors?.values.some(
          (v) => v.labels.status_code === '404' && v.labels.error_type === '4xx'
        )
      ).toBe(true);
      expect(
        httpErrors?.values.some(
          (v) => v.labels.status_code === '500' && v.labels.error_type === '5xx'
        )
      ).toBe(true);
    });
  });
});
