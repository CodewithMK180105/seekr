import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@seekr/shared';
import { Retriever, RankedSearchResult } from '../search.types.js';

interface RawKeywordRow {
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
 * KeywordRetrieverService
 * 
 * Performs lexical search using PostgreSQL Full-Text Search cover density ranking (ts_rank_cd).
 * Note: This implements PostgreSQL Full-Text Search cover density ranking, NOT the BM25 algorithm.
 * 
 * Utilizes:
 * - document_chunks.search_vector (Title weighted 'A', Content weighted 'B')
 * - document_chunks_search_vector_gin_idx GIN index
 * - websearch_to_tsquery with fallback to plainto_tsquery
 */
export class KeywordRetrieverService implements Retriever {
  readonly name: string = 'keyword';
  private readonly db: PrismaClient;

  constructor(dbClient: PrismaClient = defaultPrisma) {
    this.db = dbClient;
  }

  /**
   * Search indexed document chunks using PostgreSQL Full-Text Search.
   *
   * @param query - The user search query string.
   * @param limit - Maximum number of results to return (clamped between 1 and 100, default 10).
   * @param sourceId - Optional source UUID filter.
   * @returns Array of RankedSearchResult ordered by relevance score descending.
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
      // Invalid UUID format provided as filter -> no documents can match
      return [];
    }
    const targetSourceId = sourceId && UUID_REGEX.test(sourceId) ? sourceId : null;

    try {
      // 4. Execute parameterized SQL query
      // Uses websearch_to_tsquery with plainto_tsquery fallback.
      // If query reduces to empty tsquery (e.g. only stop words or symbols),
      // the CTE yields empty tsquery and WHERE pq.tsq != ''::tsquery safely returns 0 rows.
      const rows = await this.db.$queryRaw<RawKeywordRow[]>`
        WITH parsed_query AS (
          SELECT
            CASE
              WHEN websearch_to_tsquery('english', ${cleanQuery}) != ''::tsquery
                THEN websearch_to_tsquery('english', ${cleanQuery})
              ELSE plainto_tsquery('english', ${cleanQuery})
            END AS tsq
        )
        SELECT
          dc.id AS "chunkId",
          dc.document_id AS "documentId",
          dc.chunk_index AS "chunkIndex",
          dc.content,
          d.title,
          d.url,
          s.source_type::text AS "sourceType",
          ts_rank_cd(dc.search_vector, pq.tsq) AS score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        JOIN sources s ON s.id = d.source_id
        CROSS JOIN parsed_query pq
        WHERE pq.tsq != ''::tsquery
          AND dc.search_vector @@ pq.tsq
          AND (${targetSourceId}::uuid IS NULL OR d.source_id = ${targetSourceId}::uuid)
        ORDER BY score DESC, dc.id ASC
        LIMIT ${safeLimit};
      `;

      // 5. Map rows to standardized RankedSearchResult
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
        source: 'keyword' as const,
      }));
    } catch (err) {
      console.error('[KeywordRetrieverService] Error executing full-text search:', err);
      return [];
    }
  }
}
