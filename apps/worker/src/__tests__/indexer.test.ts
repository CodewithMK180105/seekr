import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@seekr/shared';
import { processIndexJob } from '../processors/indexProcessor.js';

describe('IndexProcessor Integration', () => {
  let testSourceId: string;
  let testDocId: string;

  afterAll(async () => {
    if (testDocId) {
      await prisma.document.deleteMany({ where: { id: testDocId } });
    }
    if (testSourceId) {
      await prisma.source.deleteMany({ where: { id: testSourceId } });
    }
    await prisma.$disconnect();
  });

  it('should cleanly handle non-existent documents without throwing', async () => {
    const fakeJob = {
      id: 'fake-job-000',
      data: {
        documentId: '00000000-0000-0000-0000-000000000000',
        isUpdate: false,
      },
    } as any;

    await expect(processIndexJob(fakeJob)).resolves.not.toThrow();
  });

  it('should chunk, generate embeddings, and persist dual representation into PostgreSQL', async () => {
    // 1. Create a test source
    const source = await prisma.source.create({
      data: {
        name: 'Indexer Test Source',
        baseUrl: 'https://test-indexer.example.com',
        sourceType: 'DOCUMENTATION',
      },
    });
    testSourceId = source.id;

    // 2. Create a test document with multiple sentences
    const doc = await prisma.document.create({
      data: {
        sourceId: source.id,
        url: 'https://test-indexer.example.com/guide',
        title: 'High-Performance Search Engines',
        content: `Search engines require fast retrieval mechanisms.
Full-text search provides exact and fuzzy keyword matching using inverted indexes.
Dense vector search encodes semantic meaning into high-dimensional vector spaces.
Combining keyword and vector retrieval via Reciprocal Rank Fusion achieves superior accuracy.
PostgreSQL with pgvector and tsvector allows both strategies to run in a unified data store.`,
        contentHash: 'mock-hash-12345',
      },
    });
    testDocId = doc.id;

    // 3. Process index job
    const indexJob = {
      id: 'index-job-test-1',
      data: {
        documentId: doc.id,
        isUpdate: false,
      },
    } as any;

    await processIndexJob(indexJob);

    // 4. Verify chunks were persisted
    const chunks: any[] = await prisma.$queryRaw`
      SELECT id, chunk_index, token_count, content,
             (embedding IS NOT NULL) AS has_vector,
             (search_vector IS NOT NULL) AS has_tsvector
      FROM "document_chunks"
      WHERE "document_id" = ${doc.id}::uuid
      ORDER BY "chunk_index" ASC
    `;

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].has_vector).toBe(true);
    expect(chunks[0].has_tsvector).toBe(true);
    expect(chunks[0].token_count).toBeGreaterThan(0);

    // 5. Verify re-indexing (isUpdate = true)
    const updateJob = {
      id: 'index-job-test-2',
      data: {
        documentId: doc.id,
        isUpdate: true,
      },
    } as any;

    await processIndexJob(updateJob);

    const updatedChunks: any[] = await prisma.$queryRaw`
      SELECT id, chunk_index FROM "document_chunks"
      WHERE "document_id" = ${doc.id}::uuid
    `;

    expect(updatedChunks.length).toBe(chunks.length);
  });
});
