import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Search Foundation Endpoints', () => {
  describe('GET /api/v1/search', () => {
    it('returns 422 when search query "q" is omitted', async () => {
      const res = await request(app).get('/api/v1/search');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('returns 200 with live search response for valid query', async () => {
      const res = await request(app).get('/api/v1/search?q=redis+persistence&mode=hybrid');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.query).toBe('redis persistence');
      expect(res.body.data.mode).toBe('HYBRID');
      expect(res.body.data.searchId).toBeDefined();
      expect(res.body.data.searchQueryId).toBeDefined();
      expect(Array.isArray(res.body.data.results)).toBe(true);
      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        offset: 0,
      });
      expect(typeof res.body.data.pagination.total).toBe('number');
      expect(typeof res.body.data.pagination.hasMore).toBe('boolean');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('supports KEYWORD and SEMANTIC modes with correct result metadata', async () => {
      const resKw = await request(app).get('/api/v1/search?q=redis&mode=KEYWORD');
      expect(resKw.status).toBe(200);
      expect(resKw.body.data.mode).toBe('KEYWORD');

      const resSem = await request(app).get('/api/v1/search?q=redis&mode=SEMANTIC');
      expect(resSem.status).toBe(200);
      expect(resSem.body.data.mode).toBe('SEMANTIC');
    });

    it('returns 422 when limit exceeds 100 or page is 0', async () => {
      const resA = await request(app).get('/api/v1/search?q=redis&limit=150');
      expect(resA.status).toBe(422);

      const resB = await request(app).get('/api/v1/search?q=redis&page=0');
      expect(resB.status).toBe(422);
    });
  });

  describe('GET /api/v1/search/suggestions', () => {
    it('returns 422 when prefix query "q" is omitted or empty', async () => {
      const res = await request(app).get('/api/v1/search/suggestions');
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 with suggestions payload for valid prefix query', async () => {
      const res = await request(app).get('/api/v1/search/suggestions?q=red&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.query).toBe('red');
      expect(Array.isArray(res.body.data.suggestions)).toBe(true);
    });
  });

  describe('POST /api/v1/search/feedback', () => {
    it('returns 422 for malformed feedback payload', async () => {
      const res = await request(app).post('/api/v1/search/feedback').send({
        searchId: 'not-a-uuid',
        chunkId: 'not-a-uuid',
        action: 'click',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when search query does not exist', async () => {
      const nonExistentSearchId = '00000000-0000-0000-0000-000000000000';
      const dummyChunkId = '11111111-1111-1111-1111-111111111111';

      const res = await request(app).post('/api/v1/search/feedback').send({
        searchId: nonExistentSearchId,
        chunkId: dummyChunkId,
        action: 'click',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 acknowledging valid click feedback payload for logged results', async () => {
      // 1. Perform search to generate query and logged results
      const searchRes = await request(app).get('/api/v1/search?q=redis&mode=KEYWORD');
      expect(searchRes.status).toBe(200);

      const searchId = searchRes.body.data.searchQueryId || searchRes.body.data.searchId;
      expect(searchId).toBeDefined();

      if (searchRes.body.data.results.length > 0) {
        const chunkId = searchRes.body.data.results[0].chunkId;

        // Brief delay to allow async logging to complete in DB
        await new Promise((resolve) => setTimeout(resolve, 200));

        const feedbackRes = await request(app).post('/api/v1/search/feedback').send({
          searchId,
          chunkId,
          action: 'click',
        });

        expect(feedbackRes.status).toBe(200);
        expect(feedbackRes.body.success).toBe(true);
        expect(feedbackRes.body.data.recorded).toBe(true);
        expect(feedbackRes.body.data.searchId).toBe(searchId);
        expect(feedbackRes.body.data.chunkId).toBe(chunkId);
      }
    });
  });

  describe('GET /api/v1/search/analytics', () => {
    it('returns 200 with search analytics metrics and distributions', async () => {
      const res = await request(app).get('/api/v1/search/analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.totalQueries).toBe('number');
      expect(typeof res.body.data.avgLatencyMs).toBe('number');
      expect(typeof res.body.data.p50LatencyMs).toBe('number');
      expect(typeof res.body.data.p95LatencyMs).toBe('number');
      expect(typeof res.body.data.searchCtr).toBe('number');
      expect(typeof res.body.data.resultCtr).toBe('number');
      expect(res.body.data.modeDistribution).toBeDefined();
      expect(Array.isArray(res.body.data.searchModeDistribution)).toBe(true);
      expect(Array.isArray(res.body.data.topQueries)).toBe(true);
      expect(Array.isArray(res.body.data.topClickedDocuments)).toBe(true);
      expect(Array.isArray(res.body.data.zeroResultQueries)).toBe(true);
    });
  });
});
