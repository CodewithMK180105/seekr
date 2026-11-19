import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, getEmbeddingProvider, EmbeddingProvider } from '@seekr/shared';
import { Retriever, RankedSearchResult } from '../search.types.js';

interface RawVectorRow {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  title: string;
  url: string;
  sourceType: string;
  score: number | string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * VectorRetrieverService
 * 
 * Performs semantic retrieval using dense embeddings in PostgreSQL via pgvector.
 * 
 * Utilizes:
 * - Cosine distance (<=>) converted to similarity score: 1 - (embedding <=> query_vector)
 * - document_chunks_embedding_hnsw_idx HNSW index with vector_cosine_ops
 * - Configured EmbeddingProvider (Gemini / OpenAI / Mock fallback)
 */
export class VectorRetrieverService implements Retriever {
  readonly name: string = 'vector';
  private readonly db: PrismaClient;
  private readonly embeddingProvider: EmbeddingProvider;

  constructor(
    dbClient: PrismaClient = defaultPrisma,
    provider: EmbeddingProvider = getEmbeddingProvider()
  ) {
    this.db = dbClient;
    this.embeddingProvider = provider;
  }

  /**
   * Search indexed document chunks using pgvector cosine similarity.
   *
   * @param query - The user search query string.
   * @param limit - Maximum number of results to return (clamped between 1 and 100, default 10).
   * @param sourceId - Optional source UUID filter.
   * @returns Array of RankedSearchResult ordered by cosine similarity score descending.
   */
  async search(
    query: string,
    limit: number = 10,
    sourceId?: string
  ): Promise<RankedSearchResult[]> {
    // 1. Validate and normalize query
    if (!query || typeof query !== 'string') {
      return [];
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length === 0) {
      return [];
    }

    // 2. Validate limit
    const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 10, 100));

    // 3. Validate sourceId if supplied
    if (sourceId !== undefined && sourceId !== null && !UUID_REGEX.test(sourceId)) {
      return [];
    }
    const targetSourceId = sourceId && UUID_REGEX.test(sourceId) ? sourceId : null;

    try {
      // 4. Generate query embedding
      const queryEmbedding = await this.embeddingProvider.embedText(cleanQuery);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('[VectorRetrieverService] Embedding generation returned empty vector.');
        return [];
      }

      const vectorString = `[${queryEmbedding.join(',')}]`;

      // 5. Execute parameterized SQL query using pgvector cosine distance
      // (1 - (dc.embedding <=> query_vector)) yields cosine similarity
      // ORDER BY dc.embedding <=> query_vector ASC uses the HNSW cosine index
      const rows = await this.db.$queryRaw<RawVectorRow[]>`
        SELECT
          dc.id AS "chunkId",
          dc.document_id AS "documentId",
          dc.chunk_index AS "chunkIndex",
          dc.content,
          d.title,
          d.url,
          s.source_type::text AS "sourceType",
          (1 - (dc.embedding <=> ${vectorString}::vector)) AS score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        JOIN sources s ON s.id = d.source_id
        WHERE dc.embedding IS NOT NULL
          AND (${targetSourceId}::uuid IS NULL OR d.source_id = ${targetSourceId}::uuid)
        ORDER BY dc.embedding <=> ${vectorString}::vector ASC, dc.id ASC
        LIMIT ${safeLimit};
      `;

      // 6. Map rows to standardized RankedSearchResult
      return rows.map((row, index) => ({
        chunkId: row.chunkId,
        documentId: row.documentId,
        chunkIndex: row.chunkIndex,
        content: row.content,
        title: row.title,
        url: row.url,
        sourceType: row.sourceType,
        rank: index + 1,
        score: Number(row.score),
        source: 'vector' as const,
      }));
    } catch (err) {
      console.error('[VectorRetrieverService] Error executing vector search:', err);
      return [];
    }
  }
}
