import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma, signAccessToken, getCrawlerQueue } from '@seekr/shared';
import { config } from '../config/index.js';

vi.mock('@seekr/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@seekr/shared')>();
  return {
    ...actual,
    prisma: {
      source: {
        findUnique: vi.fn(),
      },
      crawlJob: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    },
    getCrawlerQueue: vi.fn().mockReturnValue({
      add: vi.fn().mockResolvedValue({ id: 'bullmq-job-1' }),
    }),
  };
});

describe('Crawl Jobs Endpoints', () => {
  const validToken = signAccessToken(
    { userId: 'user-uuid-1', email: 'admin@seekr.dev' },
    config.JWT_ACCESS_SECRET
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/crawl-jobs', () => {
    const sourceId = '123e4567-e89b-12d3-a456-426614174000';

    it('returns 404 if source does not exist', async () => {
      vi.mocked(prisma.source.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/crawl-jobs')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sourceId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 if source is disabled', async () => {
      vi.mocked(prisma.source.findUnique).mockResolvedValueOnce({
        id: sourceId,
        status: 'DISABLED',
      } as any);

      const res = await request(app)
        .post('/api/v1/crawl-jobs')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sourceId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('creates job and returns 202 Accepted for async processing', async () => {
      vi.mocked(prisma.source.findUnique).mockResolvedValueOnce({
        id: sourceId,
        name: 'Redis',
        baseUrl: 'https://redis.io',
        status: 'ACTIVE',
      } as any);

      vi.mocked(prisma.crawlJob.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.crawlJob.create).mockResolvedValueOnce({
        id: 'crawl-job-123',
        sourceId,
        createdBy: 'user-uuid-1',
        status: 'PENDING',
        pagesProcessed: 0,
        pagesFailed: 0,
        retryCount: 0,
        createdAt: new Date(),
        source: { name: 'Redis', baseUrl: 'https://redis.io' },
      } as any);

      const res = await request(app)
        .post('/api/v1/crawl-jobs')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sourceId, maxPages: 10, maxDepth: 2 });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.id).toBe('crawl-job-123');
      expect(res.body.data.job.status).toBe('PENDING');

      // Verify BullMQ job dispatch
      expect(getCrawlerQueue().add).toHaveBeenCalledWith(
        'crawl',
        expect.objectContaining({
          crawlJobId: 'crawl-job-123',
          sourceId,
          baseUrl: 'https://redis.io',
          maxPages: 10,
        }),
        expect.anything()
      );
    });
  });

  describe('GET /api/v1/crawl-jobs/:id', () => {
    it('returns crawl job progress', async () => {
      vi.mocked(prisma.crawlJob.findUnique).mockResolvedValueOnce({
        id: 'crawl-job-123',
        sourceId: 'source-1',
        createdBy: 'user-1',
        status: 'RUNNING',
        pagesProcessed: 8,
        pagesFailed: 1,
        retryCount: 0,
        createdAt: new Date(),
        source: { name: 'Redis', baseUrl: 'https://redis.io' },
      } as any);

      const res = await request(app)
        .get('/api/v1/crawl-jobs/crawl-job-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.pagesProcessed).toBe(8);
      expect(res.body.data.job.status).toBe('RUNNING');
    });
  });
});
