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
    const validSearchId = '123e4567-e89b-12d3-a456-426614174000';
    const validChunkId = '987fcdeb-51a2-43f7-9876-ba0987654321';

    it('returns 422 for malformed feedback payload', async () => {
      const res = await request(app).post('/api/v1/search/feedback').send({
        searchId: 'not-a-uuid',
        chunkId: validChunkId,
        action: 'click',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 acknowledging valid click feedback payload', async () => {
      const res = await request(app).post('/api/v1/search/feedback').send({
        searchId: validSearchId,
        chunkId: validChunkId,
        action: 'click',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recorded).toBe(true);
      expect(res.body.data.searchId).toBe(validSearchId);
      expect(res.body.data.chunkId).toBe(validChunkId);
    });
  });
});
