import { describe, it, expect } from 'vitest';
import { queryUnderstandingService } from '../services/query-understanding.service.js';

describe('QueryUnderstandingService Unit Tests', () => {
  it('1. normalizes conversational queries cleanly while preserving core keywords', () => {
    const q1 = queryUnderstandingService.parseQuery('Give me the details about Paris');
    expect(q1.isConversational).toBe(true);
    expect(q1.cleanedQuery).toBe('Paris');
    expect(q1.coreKeywords).toContain('paris');
    expect(q1.originalQuery).toBe('Give me the details about Paris');

    const q2 = queryUnderstandingService.parseQuery('Can you please tell me how snapshotting works in Redis?');
    expect(q2.isConversational).toBe(true);
    expect(q2.coreKeywords).toContain('snapshotting');
    expect(q2.coreKeywords).toContain('redis');
    expect(q2.originalQuery).toBe('Can you please tell me how snapshotting works in Redis?');
  });

  it('2. preserves legitimate technical acronyms and does not misclassify them as gibberish', () => {
    const acronyms = ['SSRF', 'RAG', 'HNSW', 'RDB', 'AOF', 'CRUD', 'UUID', 'JSON', 'YAML', 'HTTP', 'gRPC', 'K8s', 'IPv6'];
    for (const acr of acronyms) {
      const parsed = queryUnderstandingService.parseQuery(acr);
      expect(parsed.isGibberish).toBe(false);
      expect(parsed.category).not.toBe('GIBBERISH');
    }
  });

  it('3. accurately identifies keyboard mashing and nonsense as gibberish', () => {
    const gibberishQueries = ['fttxtx', 'aslkdjfhlaksjdf', 'zzxxqq99', 'asdfghjk', '!@#$%^&*', 'aaaaaa'];
    for (const gib of gibberishQueries) {
      const parsed = queryUnderstandingService.parseQuery(gib);
      expect(parsed.isGibberish).toBe(true);
      expect(parsed.category).toBe('GIBBERISH');
    }
  });

  it('4. classifies comparison queries accurately', () => {
    const q1 = queryUnderstandingService.parseQuery('Redis RDB vs AOF difference');
    expect(q1.category).toBe('COMPARISON');

    const q2 = queryUnderstandingService.parseQuery('difference between PostgreSQL B-Tree and GIN index');
    expect(q2.category).toBe('COMPARISON');
  });

  it('5. classifies troubleshooting queries accurately', () => {
    const q1 = queryUnderstandingService.parseQuery('Retrying failing jobs in BullMQ');
    expect(q1.category).toBe('TROUBLESHOOTING');

    const q2 = queryUnderstandingService.parseQuery('Why is my Docker container crashing with out of memory error?');
    expect(q2.category).toBe('TROUBLESHOOTING');
  });

  it('6. classifies conceptual queries accurately', () => {
    const q = queryUnderstandingService.parseQuery('How does vector similarity search work?');
    expect(q.category).toBe('CONCEPTUAL');
  });

  it('7. classifies direct URLs accurately', () => {
    const q1 = queryUnderstandingService.parseQuery('https://redis.io/docs/latest/operate');
    expect(q1.category).toBe('DIRECT_URL');

    const q2 = queryUnderstandingService.parseQuery('docs.docker.com/engine/network');
    expect(q2.category).toBe('DIRECT_URL');
  });

  it('8. detects freshness intent when time-sensitive terms are present', () => {
    const q1 = queryUnderstandingService.parseQuery('Latest ECMAScript 2026 features');
    expect(q1.requiresFreshness).toBe(true);

    const q2 = queryUnderstandingService.parseQuery('What is the theory of general relativity?');
    expect(q2.requiresFreshness).toBe(false);
  });
});
