import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../../../app.js';
import { prisma, registerLlmProvider, resetLlmProvider, MockLlmProvider } from '@seekr/shared';

describe('Research Module REST & Streaming API Integration Tests', () => {
  const createdSessionIds: string[] = [];

  beforeAll(() => {
    // Register deterministic Mock provider for Gemini in API tests
    const mockProvider = new MockLlmProvider({
      defaultReply:
        'Redis achieves durability using Append-Only File (AOF) persistence [1] and point-in-time snapshotting [2].',
      latencyMs: 1,
    });
    registerLlmProvider('gemini', mockProvider);
  });

  afterAll(async () => {
    resetLlmProvider();
    if (createdSessionIds.length > 0) {
      await prisma.researchSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
  });

  describe('POST /api/v1/research (Synchronous Synthesis)', () => {
    it('1. executes research query, returns structured answer with citations, and persists session', async () => {
      const res = await request(app)
        .post('/api/v1/research')
        .send({
          query: 'redis persistence',
          mode: 'HYBRID',
          maxSources: 3,
          temperature: 0.2,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.id).toBeDefined();
      createdSessionIds.push(data.id);

      expect(data.query).toBe('redis persistence');
      expect(data.searchMode).toBe('HYBRID');
      expect(typeof data.answer).toBe('string');
      expect(data.answer.length).toBeGreaterThan(0);
      expect(Array.isArray(data.citations)).toBe(true);
      expect(Array.isArray(data.sources)).toBe(true);
      expect(typeof data.latencyMs).toBe('number');
      expect(data.insufficientContext).toBe(false);

      // Verify persisted in PostgreSQL
      const persisted = await prisma.researchSession.findUnique({
        where: { id: data.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.query).toBe('redis persistence');
    });

    it('2. returns 422 when query is empty or whitespace', async () => {
      const res = await request(app).post('/api/v1/research').send({ query: '   ' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid request input');
    });

    it('3. returns 422 when search mode is invalid', async () => {
      const res = await request(app).post('/api/v1/research').send({
        query: 'Valid query',
        mode: 'INVALID_MODE',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('4. returns 422 when maxSources exceeds allowed limit (> 20)', async () => {
      const res = await request(app).post('/api/v1/research').send({
        query: 'Valid query',
        maxSources: 50,
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('5. returns 422 when temperature is out of range (> 1.0)', async () => {
      const res = await request(app).post('/api/v1/research').send({
        query: 'Valid query',
        temperature: 2.5,
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/research/:id (Session Retrieval)', () => {
    it('6. retrieves an existing research session by UUID', async () => {
      const sessionId = randomUUID();
      createdSessionIds.push(sessionId);

      await prisma.researchSession.create({
        data: {
          id: sessionId,
          query: 'Test session query',
          answer: 'Test session answer [1].',
          searchMode: 'HYBRID',
          citations: [
            {
              citationId: '[1]',
              citationIndex: 1,
              claim: 'Test claim',
              isVerified: true,
              verificationStatus: 'verified',
            },
          ],
          sources: [
            {
              citationId: '[1]',
              citationIndex: 1,
              title: 'Source Title',
              url: 'https://example.com',
            },
          ],
          latencyMs: 95,
        },
      });

      const res = await request(app).get(`/api/v1/research/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(sessionId);
      expect(res.body.data.query).toBe('Test session query');
      expect(res.body.data.answer).toBe('Test session answer [1].');
    });

    it('7. returns 404 when research session does not exist', async () => {
      const nonexistentId = randomUUID();
      const res = await request(app).get(`/api/v1/research/${nonexistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('was not found');
    });

    it('8. returns 422 when session ID is not a valid UUID', async () => {
      const res = await request(app).get('/api/v1/research/not-a-uuid-123');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid research session ID format');
    });
  });

  describe('GET /api/v1/research/:id/sources (Sources Retrieval)', () => {
    it('9. retrieves detailed sources and attached citations for a session', async () => {
      const sessionId = randomUUID();
      createdSessionIds.push(sessionId);

      await prisma.researchSession.create({
        data: {
          id: sessionId,
          query: 'Sources query test',
          answer: 'Answer with citation [1].',
          searchMode: 'SEMANTIC',
          citations: [
            {
              citationId: '[1]',
              citationIndex: 1,
              chunkId: 'chunk-abc',
              claim: 'Answer with citation [1].',
              isVerified: true,
              verificationStatus: 'verified',
            },
          ],
          sources: [
            {
              citationId: '[1]',
              citationIndex: 1,
              chunkId: 'chunk-abc',
              title: 'Sources Doc',
              url: 'https://example.com/sources',
              sourceType: 'web',
              score: 0.9,
              rank: 1,
              content: 'Sources doc content.',
              tokenCount: 10,
              truncated: false,
              suspicious: false,
            },
          ],
          latencyMs: 70,
        },
      });

      const res = await request(app).get(`/api/v1/research/${sessionId}/sources`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBe(sessionId);
      expect(res.body.data.sources).toHaveLength(1);
      expect(res.body.data.sources[0].citationId).toBe('[1]');
      expect(res.body.data.sources[0].citationReferences).toHaveLength(1);
      expect(res.body.data.sources[0].citationReferences[0].claim).toBe('Answer with citation [1].');
    });

    it('10. returns 404 for nonexistent session sources', async () => {
      const nonexistentId = randomUUID();
      const res = await request(app).get(`/api/v1/research/${nonexistentId}/sources`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('11. returns 422 for malformed UUID on sources endpoint', async () => {
      const res = await request(app).get('/api/v1/research/invalid-uuid/sources');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/research/stream (SSE Streaming)', () => {
    it('12. streams SSE events with correct headers and event ordering: sources -> token -> citations -> complete', async () => {
      const res = await request(app)
        .post('/api/v1/research/stream')
        .send({
          query: 'redis persistence',
          mode: 'HYBRID',
          maxSources: 2,
        })
        .expect('Content-Type', /text\/event-stream/)
        .expect('Cache-Control', /no-cache/)
        .expect(200);

      const rawSse = res.text;
      expect(rawSse).toContain('event: sources');
      expect(rawSse).toContain('event: token');
      expect(rawSse).toContain('event: citations');
      expect(rawSse).toContain('event: complete');

      // Check event ordering
      const sourcesIndex = rawSse.indexOf('event: sources');
      const tokenIndex = rawSse.indexOf('event: token');
      const citationsIndex = rawSse.indexOf('event: citations');
      const completeIndex = rawSse.indexOf('event: complete');

      expect(sourcesIndex).toBeLessThan(tokenIndex);
      expect(tokenIndex).toBeLessThan(citationsIndex);
      expect(citationsIndex).toBeLessThan(completeIndex);

      // Parse complete event payload and extract session ID
      const completeMatch = rawSse.match(/event: complete\ndata: (\{.*?\})\n\n/);
      expect(completeMatch).not.toBeNull();
      const completeData = JSON.parse(completeMatch![1]);
      expect(completeData.id).toBeDefined();
      createdSessionIds.push(completeData.id);

      // Verify stream saved to PostgreSQL
      const persisted = await prisma.researchSession.findUnique({
        where: { id: completeData.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.query).toBe('redis persistence');
    });

    it('13. returns 422 JSON error when streaming request fails validation prior to SSE headers', async () => {
      const res = await request(app).post('/api/v1/research/stream').send({
        query: '', // Invalid empty query
      });

      expect(res.status).toBe(422);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.success).toBe(false);
    });
  });
});
