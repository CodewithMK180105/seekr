import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Health Endpoints', () => {
  it('GET /health returns 200 with status ok and uptime', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /non-existent-route returns 404 with standard ApiResponse format', async () => {
    const res = await request(app).get('/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta.requestId).toBeDefined();
  });
});
