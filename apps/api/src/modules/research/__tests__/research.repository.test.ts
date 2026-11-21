import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@seekr/shared';
import { ResearchRepository } from '../research.repository.js';
import { VerifiedCitation } from '../citation-post-processor.js';

describe('ResearchRepository Integration Tests', () => {
  const repository = new ResearchRepository();
  const createdSessionIds: string[] = [];

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await prisma.researchSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
  });

  it('1. creates and retrieves a research session from PostgreSQL', async () => {
    const sessionId = randomUUID();
    createdSessionIds.push(sessionId);

    const mockCitations: VerifiedCitation[] = [
      {
        citationId: '[1]',
        citationIndex: 1,
        chunkId: randomUUID(),
        documentId: randomUUID(),
        title: 'Redis Durability',
        url: 'https://redis.io/durability',
        sourceType: 'web',
        score: 0.95,
        claim: 'Redis logs to AOF [1].',
        excerpt: 'AOF logs write operations.',
        isVerified: true,
        verificationStatus: 'verified',
      },
    ];

    const mockSources = [
      {
        citationId: '[1]',
        citationIndex: 1,
        chunkId: mockCitations[0].chunkId!,
        documentId: mockCitations[0].documentId!,
        title: 'Redis Durability',
        url: 'https://redis.io/durability',
        sourceType: 'web',
        score: 0.95,
        rank: 1,
        content: 'AOF logs write operations.',
        tokenCount: 15,
        truncated: false,
        suspicious: false,
      },
    ];

    const created = await repository.createSession({
      id: sessionId,
      query: 'How does Redis persist data?',
      answer: 'Redis logs to AOF [1].',
      searchMode: 'HYBRID',
      citations: mockCitations,
      sources: mockSources,
      latencyMs: 145,
    });

    expect(created.id).toBe(sessionId);
    expect(created.query).toBe('How does Redis persist data?');
    expect(created.searchMode).toBe('HYBRID');
    expect(created.latencyMs).toBe(145);

    // Retrieve by ID
    const retrieved = await repository.getSessionById(sessionId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(sessionId);
    expect(retrieved?.answer).toBe('Redis logs to AOF [1].');
  });

  it('2. retrieves detailed sources and attaches associated citation references', async () => {
    const sessionId = randomUUID();
    createdSessionIds.push(sessionId);

    const chunkId = randomUUID();
    const docId = randomUUID();

    const mockCitations: VerifiedCitation[] = [
      {
        citationId: '[1]',
        citationIndex: 1,
        chunkId,
        documentId: docId,
        title: 'PostgreSQL Performance',
        url: 'https://postgresql.org',
        sourceType: 'web',
        score: 0.9,
        claim: 'Postgres uses MVCC [1].',
        excerpt: 'MVCC provides read-write concurrency.',
        isVerified: true,
        verificationStatus: 'verified',
      },
    ];

    const mockSources = [
      {
        citationId: '[1]',
        citationIndex: 1,
        chunkId,
        documentId: docId,
        title: 'PostgreSQL Performance',
        url: 'https://postgresql.org',
        sourceType: 'web',
        score: 0.9,
        rank: 1,
        content: 'MVCC provides read-write concurrency.',
        tokenCount: 20,
        truncated: false,
        suspicious: false,
      },
    ];

    await repository.createSession({
      id: sessionId,
      query: 'What is MVCC?',
      answer: 'Postgres uses MVCC [1].',
      searchMode: 'SEMANTIC',
      citations: mockCitations,
      sources: mockSources,
      latencyMs: 80,
    });

    const sources = await repository.getSourcesBySessionId(sessionId);
    expect(sources).not.toBeNull();
    expect(sources).toHaveLength(1);
    expect(sources![0].citationId).toBe('[1]');
    expect(sources![0].title).toBe('PostgreSQL Performance');
    expect(sources![0].citationReferences).toHaveLength(1);
    expect(sources![0].citationReferences![0].claim).toBe('Postgres uses MVCC [1].');
  });

  it('3. returns null when fetching nonexistent sessions or sources', async () => {
    const randomId = randomUUID();
    const session = await repository.getSessionById(randomId);
    expect(session).toBeNull();

    const sources = await repository.getSourcesBySessionId(randomId);
    expect(sources).toBeNull();
  });
});
