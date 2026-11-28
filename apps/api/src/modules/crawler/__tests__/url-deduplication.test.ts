import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractDomain } from '../url-normalizer.js';
import { deduplicateByDocument } from '../../search/services/search.service.js';
import { SearchResultItem } from '@seekr/types';

describe('URL Normalization & Deduplication', () => {
  it('strips tracking parameters and hashes from URLs', () => {
    const raw = 'https://en.wikipedia.org/wiki/Paris?utm_source=twitter&utm_medium=social#History';
    const norm = normalizeUrl(raw);
    expect(norm).toBe('https://en.wikipedia.org/wiki/Paris');
  });

  it('normalizes trailing slashes consistently', () => {
    const withSlash = 'https://docs.python.org/3/tutorial/';
    const withoutSlash = 'https://docs.python.org/3/tutorial';
    expect(normalizeUrl(withSlash)).toBe('https://docs.python.org/3/tutorial');
    expect(normalizeUrl(withoutSlash)).toBe('https://docs.python.org/3/tutorial');
  });

  it('normalizes mobile Wikipedia URLs to canonical desktop domain', () => {
    const mobile = 'https://en.m.wikipedia.org/wiki/Paris';
    expect(normalizeUrl(mobile)).toBe('https://en.wikipedia.org/wiki/Paris');
  });

  it('extracts clean domains for diversity controls', () => {
    expect(extractDomain('https://www.redis.io/docs/latest/persistence/')).toBe('redis.io');
    expect(extractDomain('https://en.wikipedia.org/wiki/Paris')).toBe('en.wikipedia.org');
  });

  it('deduplicates multiple search result chunks belonging to the same document', () => {
    const mockItems: SearchResultItem[] = [
      {
        chunkId: 'chunk-1',
        documentId: 'doc-paris',
        chunkIndex: 0,
        title: 'Paris - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Paris',
        content: 'Paris chunk 0 intro content',
        score: 0.85,
        rank: 1,
        sourceType: 'WEBSITE',
        keywordRank: 1,
        vectorRank: 1,
        matchedBy: { keyword: true, vector: true },
      },
      {
        chunkId: 'chunk-2',
        documentId: 'doc-paris',
        chunkIndex: 1,
        title: 'Paris - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Paris',
        content: 'Paris chunk 1 history content',
        score: 0.80,
        rank: 2,
        sourceType: 'WEBSITE',
        keywordRank: 2,
        vectorRank: 2,
        matchedBy: { keyword: true, vector: true },
      },
      {
        chunkId: 'chunk-3',
        documentId: 'doc-paris',
        chunkIndex: 2,
        title: 'Paris - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Paris',
        content: 'Paris chunk 2 geography content',
        score: 0.75,
        rank: 3,
        sourceType: 'WEBSITE',
        keywordRank: 3,
        vectorRank: 3,
        matchedBy: { keyword: true, vector: true },
      },
      {
        chunkId: 'chunk-4',
        documentId: 'doc-london',
        chunkIndex: 0,
        title: 'London - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/London',
        content: 'London is the capital of the UK',
        score: 0.65,
        rank: 4,
        sourceType: 'WEBSITE',
        keywordRank: 4,
        vectorRank: 4,
        matchedBy: { keyword: true, vector: true },
      },
    ];

    const deduplicated = deduplicateByDocument(mockItems);
    expect(deduplicated.length).toBe(2);
    expect(deduplicated[0].documentId).toBe('doc-paris');
    expect(deduplicated[0].chunkId).toBe('chunk-1'); // preserves top-scoring chunk
    expect(deduplicated[1].documentId).toBe('doc-london');
  });
});
