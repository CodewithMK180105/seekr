import { describe, it, expect } from 'vitest';
import { CitationPostProcessor } from '../citation-post-processor.js';
import { AssembledSource } from '../types.js';

describe('CitationPostProcessor Unit Tests', () => {
  const postProcessor = new CitationPostProcessor();

  const mockSources: AssembledSource[] = [
    {
      citationId: '[1]',
      citationIndex: 1,
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      title: 'PostgreSQL Indexing',
      url: 'https://postgresql.org/indexes',
      sourceType: 'web',
      score: 0.95,
      rank: 1,
      content: 'B-tree indexes in PostgreSQL support equality and range queries on data that can be sorted into some normal order.',
      tokenCount: 40,
      truncated: false,
      suspicious: false,
    },
    {
      citationId: '[2]',
      citationIndex: 2,
      chunkId: 'chunk-2',
      documentId: 'doc-2',
      chunkIndex: 0,
      title: 'GIN Indexing Guide',
      url: 'https://postgresql.org/gin',
      sourceType: 'web',
      score: 0.88,
      rank: 2,
      content: 'GIN indexes are inverted indexes designed for composite values like tsvector and full-text documents.',
      tokenCount: 35,
      truncated: false,
      suspicious: false,
    },
  ];

  it('1. correctly maps valid inline citations to source metadata and extracts supporting excerpts', () => {
    const answer =
      'B-tree indexes are effective for range queries [1]. ' +
      'Meanwhile, GIN indexes excel at inverted full-text lookups [2].';

    const result = postProcessor.process(answer, mockSources);

    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.citations).toHaveLength(2);

    const c1 = result.citations[0];
    expect(c1.citationId).toBe('[1]');
    expect(c1.citationIndex).toBe(1);
    expect(c1.isVerified).toBe(true);
    expect(c1.chunkId).toBe('chunk-1');
    expect(c1.title).toBe('PostgreSQL Indexing');
    expect(c1.url).toBe('https://postgresql.org/indexes');
    expect(c1.claim).toContain('range queries [1]');
    expect(c1.excerpt).toContain('B-tree indexes in PostgreSQL support equality and range queries');

    const c2 = result.citations[1];
    expect(c2.citationId).toBe('[2]');
    expect(c2.citationIndex).toBe(2);
    expect(c2.isVerified).toBe(true);
    expect(c2.chunkId).toBe('chunk-2');
    expect(c2.excerpt).toContain('GIN indexes are inverted indexes');
  });

  it('2. detects and flags invalid or unknown citation IDs not present in the context', () => {
    const answer = 'Redis stores data in RAM [99] and snapshots to disk [0].';

    const result = postProcessor.process(answer, mockSources);

    expect(result.invalidCount).toBe(2);
    expect(result.validCount).toBe(0);

    const c99 = result.citations.find((c) => c.citationIndex === 99);
    expect(c99).toBeDefined();
    expect(c99?.isVerified).toBe(false);
    expect(c99?.verificationStatus).toBe('unsupported_source');
    expect(c99?.reason).toContain('does not correspond to any source');

    const c0 = result.citations.find((c) => c.citationIndex === 0);
    expect(c0).toBeDefined();
    expect(c0?.isVerified).toBe(false);
    expect(c0?.verificationStatus).toBe('invalid_index');
  });

  it('3. identifies uncited sources provided in context', () => {
    const answer = 'PostgreSQL relies on B-tree indexes for range scans [1].';

    const result = postProcessor.process(answer, mockSources);

    expect(result.validCount).toBe(1);
    expect(result.uncitedSourceCount).toBe(1);
    expect(result.uncitedSources).toHaveLength(1);
    expect(result.uncitedSources[0].citationId).toBe('[2]');
  });

  it('4. extracts multiple citations within a single compound claim sentence', () => {
    const answer = 'Relational databases combine B-trees [1] alongside GIN inverted indexes [2] for high performance.';

    const result = postProcessor.process(answer, mockSources);

    expect(result.validCount).toBe(2);
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0].citationId).toBe('[1]');
    expect(result.citations[1].citationId).toBe('[2]');
    expect(result.citations[0].claim).toBe(result.citations[1].claim);
  });

  it('5. identifies substantive claims made without any citations', () => {
    const answer =
      'B-trees handle sorting [1]. ' +
      'Databases also consume significant system memory for buffer pools.';

    const result = postProcessor.process(answer, mockSources);

    expect(result.claimsWithoutCitations).toHaveLength(1);
    expect(result.claimsWithoutCitations[0]).toContain('consume significant system memory');
  });

  it('6. handles empty or whitespace-only answers gracefully', () => {
    const result = postProcessor.process('   ', mockSources);

    expect(result.citations).toHaveLength(0);
    expect(result.validCount).toBe(0);
    expect(result.uncitedSourceCount).toBe(2);
  });
});
