import { describe, it, expect } from 'vitest';
import { SearchResultItem } from '@seekr/types';
import { ContextAssembler } from '../context-assembler.js';

describe('ContextAssembler Unit Tests', () => {
  const createMockChunk = (
    id: string,
    rank: number,
    score: number,
    content: string,
    title = 'Document Title',
    url = 'https://example.com/doc'
  ): SearchResultItem => ({
    chunkId: `chunk-${id}`,
    documentId: `doc-${id}`,
    chunkIndex: 0,
    title,
    url,
    content,
    score,
    rank,
    sourceType: 'web',
  });

  it('1. packs context within configured token limits', () => {
    const assembler = new ContextAssembler({
      maxContextTokens: 500,
      reservedResponseTokens: 100,
      safetyMarginTokens: 50,
    });

    const chunks = [
      createMockChunk('1', 1, 0.95, 'Sentence one about database indexing. '.repeat(10)),
      createMockChunk('2', 2, 0.85, 'Sentence two about b-tree performance. '.repeat(10)),
      createMockChunk('3', 3, 0.75, 'Sentence three about hash maps. '.repeat(20)),
    ];

    const assembled = assembler.assemble('Explain database indexing', chunks);

    expect(assembled.insufficientContext).toBe(false);
    expect(assembled.sources.length).toBeGreaterThan(0);
    expect(assembled.tokenBudget.usedContextTokens).toBeLessThanOrEqual(
      assembled.tokenBudget.availableContextTokens
    );
  });

  it('2. prioritizes higher-ranked results over lower-ranked results', () => {
    const assembler = new ContextAssembler({
      maxSources: 2,
    });

    const chunks = [
      createMockChunk('3', 3, 0.70, 'Third rank chunk content.'),
      createMockChunk('1', 1, 0.99, 'First rank chunk content.'),
      createMockChunk('2', 2, 0.88, 'Second rank chunk content.'),
      createMockChunk('4', 4, 0.50, 'Fourth rank chunk content.'),
    ];

    const assembled = assembler.assemble('Query', chunks);

    expect(assembled.sources).toHaveLength(2);
    expect(assembled.sources[0].chunkId).toBe('chunk-1');
    expect(assembled.sources[0].citationId).toBe('[1]');
    expect(assembled.sources[1].chunkId).toBe('chunk-2');
    expect(assembled.sources[1].citationId).toBe('[2]');
  });

  it('3. truncates oversized chunks deterministically while preserving boundaries', () => {
    const assembler = new ContextAssembler({
      maxChunkTokens: 50,
    });

    const longText = 'This is a very long piece of technical text. '.repeat(30);
    const chunks = [createMockChunk('1', 1, 0.9, longText)];

    const assembled = assembler.assemble('Query', chunks);

    expect(assembled.sources).toHaveLength(1);
    expect(assembled.sources[0].truncated).toBe(true);
    expect(assembled.sources[0].content).toContain('[...content truncated due to token budget...]');
    expect(assembled.formattedContext).toContain('</source>');
  });

  it('4. handles empty retrieval results gracefully with insufficientContext flag', () => {
    const assembler = new ContextAssembler();
    const assembled = assembler.assemble('Query with no results', []);

    expect(assembled.insufficientContext).toBe(true);
    expect(assembled.insufficientReason).toBe('No search results found');
    expect(assembled.sources).toHaveLength(0);
    expect(assembled.formattedContext).toBe('');
  });

  it('5. filters out chunks below the minimum relevance score', () => {
    const assembler = new ContextAssembler({
      minRelevanceScore: 0.1,
    });

    const chunks = [
      createMockChunk('1', 1, 0.05, 'Very low relevance chunk'),
      createMockChunk('2', 2, 0.01, 'Another low relevance chunk'),
    ];

    const assembled = assembler.assemble('Query', chunks);

    expect(assembled.insufficientContext).toBe(true);
    expect(assembled.insufficientReason).toContain('minimum relevance threshold');
    expect(assembled.sources).toHaveLength(0);
  });

  it('6. preserves complete source metadata for citation tracing', () => {
    const assembler = new ContextAssembler();
    const chunk = createMockChunk(
      'abc',
      1,
      0.92,
      'PostgreSQL full-text search uses tsvector and tsquery.',
      'PostgreSQL Docs',
      'https://postgresql.org/docs'
    );

    const assembled = assembler.assemble('PostgreSQL search', [chunk]);

    expect(assembled.sources).toHaveLength(1);
    const source = assembled.sources[0];
    expect(source.citationId).toBe('[1]');
    expect(source.citationIndex).toBe(1);
    expect(source.chunkId).toBe('chunk-abc');
    expect(source.documentId).toBe('doc-abc');
    expect(source.title).toBe('PostgreSQL Docs');
    expect(source.url).toBe('https://postgresql.org/docs');
    expect(source.score).toBe(0.92);
    expect(source.rank).toBe(1);
  });

  it('7. produces deterministic assembly output on identical inputs', () => {
    const assembler = new ContextAssembler();
    const chunks = [
      createMockChunk('1', 1, 0.9, 'Content alpha'),
      createMockChunk('2', 2, 0.8, 'Content beta'),
    ];

    const assembled1 = assembler.assemble('Deterministic test', chunks);
    const assembled2 = assembler.assemble('Deterministic test', chunks);

    expect(assembled1.formattedContext).toBe(assembled2.formattedContext);
    expect(assembled1.tokenBudget).toEqual(assembled2.tokenBudget);
    expect(assembled1.sources).toEqual(assembled2.sources);
  });

  it('8. handles token-budget edge case when budget is too tight for context', () => {
    const assembler = new ContextAssembler({
      maxContextTokens: 200,
      reservedResponseTokens: 150,
      safetyMarginTokens: 30, // 200 - 150 - 30 - systemTokens = negative/too small
    });

    const chunks = [createMockChunk('1', 1, 0.9, 'Some content')];
    const assembled = assembler.assemble('Query', chunks);

    expect(assembled.insufficientContext).toBe(true);
    expect(assembled.insufficientReason).toContain('token budget');
  });
});
