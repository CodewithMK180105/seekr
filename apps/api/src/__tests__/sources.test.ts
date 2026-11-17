import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma, signAccessToken } from '@seekr/shared';
import { config } from '../config/index.js';

vi.mock('@seekr/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@seekr/shared')>();
  return {
    ...actual,
    prisma: {
      source: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('Sources Endpoints', () => {
  const validToken = signAccessToken(
    { userId: 'user-uuid-1', email: 'admin@seekr.dev' },
    config.JWT_ACCESS_SECRET
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/sources', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/sources')
        .send({ name: 'Wikipedia', baseUrl: 'https://en.wikipedia.org', sourceType: 'WEBSITE' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when baseUrl points to localhost (SSRF protection)', async () => {
      const res = await request(app)
        .post('/api/v1/sources')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Internal Admin',
          baseUrl: 'http://localhost:8080',
          sourceType: 'WEBSITE',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('creates a new source successfully', async () => {
      vi.mocked(prisma.source.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.source.create).mockResolvedValueOnce({
        id: 'source-uuid-1',
        name: 'Wikipedia',
        baseUrl: 'https://en.wikipedia.org',
        sourceType: 'WEBSITE',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/sources')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Wikipedia',
          baseUrl: 'https://en.wikipedia.org',
          sourceType: 'WEBSITE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.source.name).toBe('Wikipedia');
    });
  });

  describe('GET /api/v1/sources', () => {
    it('lists all sources with document counts', async () => {
      vi.mocked(prisma.source.findMany).mockResolvedValueOnce([
        {
          id: 'source-1',
          name: 'Redis Docs',
          baseUrl: 'https://redis.io',
          sourceType: 'DOCUMENTATION',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { documents: 42 },
        },
      ] as any);

      const res = await request(app)
        .get('/api/v1/sources')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sources).toHaveLength(1);
      expect(res.body.data.sources[0].documentCount).toBe(42);
    });
  });
});
