import { describe, it, expect } from 'vitest';
import { CandidateValidatorService } from '../candidate-validator.service.js';
import { SearchProviderCandidate } from '../providers/provider.interface.js';

describe('CandidateValidatorService', () => {
  const validator = new CandidateValidatorService(0.30);

  it('accepts highly relevant candidate for entity query', () => {
    const candidate: SearchProviderCandidate = {
      url: 'https://en.wikipedia.org/wiki/Paris',
      title: 'Paris - Wikipedia',
      snippet: 'Paris is the capital and largest city of France.',
      provider: 'wikipedia',
      rank: 1,
      domain: 'en.wikipedia.org',
    };

    const res = validator.validateCandidate(candidate, 'Give me the details about Paris');
    expect(res.valid).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(0.8);
    expect(res.matchedTokens).toContain('paris');
  });

  it('rejects completely unrelated candidate returned for Paris query', () => {
    const candidate: SearchProviderCandidate = {
      url: 'https://en.wikipedia.org/wiki/Give_It_2_Me',
      title: 'Give It 2 Me - Wikipedia',
      snippet: 'Give It 2 Me is a song by American singer Madonna from her eleventh studio album.',
      provider: 'wikipedia',
      rank: 1,
      domain: 'en.wikipedia.org',
    };

    const res = validator.validateCandidate(candidate, 'Give me the details about Paris');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('REJECT_ZERO_TOKEN_OVERLAP');
  });

  it('rejects Indian political page for Paris query', () => {
    const candidate: SearchProviderCandidate = {
      url: 'https://en.wikipedia.org/wiki/Prime_Minister_of_India',
      title: 'Prime Minister of India - Wikipedia',
      snippet: 'The Prime Minister of India is the head of government of the Republic of India.',
      provider: 'wikipedia',
      rank: 2,
      domain: 'en.wikipedia.org',
    };

    const res = validator.validateCandidate(candidate, 'Give me the details about Paris');
    expect(res.valid).toBe(false);
    expect(res.score).toBe(0);
  });

  it('accepts direct URL provider candidates unconditionally', () => {
    const candidate: SearchProviderCandidate = {
      url: 'https://docs.python.org/3/library/asyncio.html',
      title: 'asyncio — Asynchronous I/O — Python documentation',
      provider: 'direct',
      rank: 1,
    };

    const res = validator.validateCandidate(candidate, 'https://docs.python.org');
    expect(res.valid).toBe(true);
    expect(res.score).toBe(1.0);
  });

  it('rejects search engine internal redirects', () => {
    const candidate: SearchProviderCandidate = {
      url: 'https://www.google.com/url?q=https://example.com',
      title: 'Example',
      provider: 'google',
      rank: 1,
    };

    const res = validator.validateCandidate(candidate, 'Example');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('REJECT_SEARCH_REDIRECT');
  });

  it('correctly handles multi-word technical queries', () => {
    const candidate: SearchProviderCandidate = {
      url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/persistence',
      title: 'Redis persistence | Redis',
      snippet: 'Learn about AOF and RDB persistence in Redis.',
      provider: 'google',
      rank: 1,
      domain: 'redis.io',
    };

    const res = validator.validateCandidate(candidate, 'How does Redis persistence and snapshotting work');
    expect(res.valid).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(0.5);
    expect(res.matchedTokens).toContain('redis');
    expect(res.matchedTokens).toContain('persistence');
  });
});
