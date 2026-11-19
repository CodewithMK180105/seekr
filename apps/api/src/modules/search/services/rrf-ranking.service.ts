import { RankedSearchResult, FusedSearchResult } from '../search.types.js';

export interface RrfOptions {
  /**
   * Smoothing constant k in RRF formula: 1 / (k + rank).
   * Default is 60.
   */
  k?: number;
}

/**
 * RrfRankingService
 * 
 * Implements Reciprocal Rank Fusion (RRF) to combine and deduplicate
 * independently ranked search result sets (lexical keyword search and vector semantic search).
 * 
 * Formula:
 *   RRF(d) = SUM(1 / (k + rank(d)))
 * 
 * Properties:
 * - Pure logic: completely independent of database and HTTP logic.
 * - Immutable: does not mutate input arrays.
 * - Deterministic tie-breaking: ties in RRF score are broken by chunkId ASC.
 */
export class RrfRankingService {
  public static readonly DEFAULT_K = 60;

  /**
   * Fuse keyword and vector results using Reciprocal Rank Fusion.
   *
   * @param keywordResults - Array of RankedSearchResult from lexical search.
   * @param vectorResults - Array of RankedSearchResult from vector semantic search.
   * @param options - Optional configuration (e.g. k parameter, default 60).
   * @returns Array of FusedSearchResult sorted by fusedScore descending.
   */
  fuse(
    keywordResults: readonly RankedSearchResult[] = [],
    vectorResults: readonly RankedSearchResult[] = [],
    options?: RrfOptions
  ): FusedSearchResult[] {
    const k = options?.k ?? RrfRankingService.DEFAULT_K;

    // Map to collect and merge chunk representations by chunkId
    const fusedMap = new Map<
      string,
      {
        chunkId: string;
        documentId: string;
        chunkIndex: number;
        content: string;
        title: string;
        url: string;
        sourceType: string;
        keywordRank: number | null;
        vectorRank: number | null;
        fusedScore: number;
      }
    >();

    // 1. Process keyword results
    // Handle potential duplicate chunk IDs within keywordResults: retain the best (minimum) rank
    for (const item of keywordResults) {
      const existing = fusedMap.get(item.chunkId);
      if (!existing) {
        fusedMap.set(item.chunkId, {
          chunkId: item.chunkId,
          documentId: item.documentId,
          chunkIndex: item.chunkIndex,
          content: item.content,
          title: item.title,
          url: item.url,
          sourceType: item.sourceType,
          keywordRank: item.rank,
          vectorRank: null,
          fusedScore: 1 / (k + item.rank),
        });
      } else if (existing.keywordRank === null || item.rank < existing.keywordRank) {
        // Re-adjust score if a better rank was found for this chunk
        const oldContribution = existing.keywordRank !== null ? 1 / (k + existing.keywordRank) : 0;
        existing.keywordRank = item.rank;
        existing.fusedScore = existing.fusedScore - oldContribution + (1 / (k + item.rank));
      }
    }

    // 2. Process vector results
    // Handle potential duplicate chunk IDs within vectorResults: retain the best (minimum) rank
    for (const item of vectorResults) {
      const existing = fusedMap.get(item.chunkId);
      if (!existing) {
        fusedMap.set(item.chunkId, {
          chunkId: item.chunkId,
          documentId: item.documentId,
          chunkIndex: item.chunkIndex,
          content: item.content,
          title: item.title,
          url: item.url,
          sourceType: item.sourceType,
          keywordRank: null,
          vectorRank: item.rank,
          fusedScore: 1 / (k + item.rank),
        });
      } else {
        if (existing.vectorRank === null) {
          // Chunk was only in keyword results so far, now present in vector as well
          existing.vectorRank = item.rank;
          existing.fusedScore += 1 / (k + item.rank);
        } else if (item.rank < existing.vectorRank) {
          // Re-adjust score if a better rank was found for this chunk in vector results
          const oldContribution = 1 / (k + existing.vectorRank);
          existing.vectorRank = item.rank;
          existing.fusedScore = existing.fusedScore - oldContribution + (1 / (k + item.rank));
        }
      }
    }

    // 3. Convert map to array with matchedBy metadata
    const results: FusedSearchResult[] = Array.from(fusedMap.values()).map((entry) => ({
      chunkId: entry.chunkId,
      documentId: entry.documentId,
      chunkIndex: entry.chunkIndex,
      content: entry.content,
      title: entry.title,
      url: entry.url,
      sourceType: entry.sourceType,
      fusedScore: entry.fusedScore,
      keywordRank: entry.keywordRank,
      vectorRank: entry.vectorRank,
      matchedBy: {
        keyword: entry.keywordRank !== null,
        vector: entry.vectorRank !== null,
      },
    }));

    // 4. Sort results: primary by fusedScore DESC, secondary by chunkId ASC (deterministic tie-breaking)
    results.sort((a, b) => {
      const scoreDiff = b.fusedScore - a.fusedScore;
      if (Math.abs(scoreDiff) > 1e-12) {
        return scoreDiff;
      }
      return a.chunkId.localeCompare(b.chunkId);
    });

    return results;
  }
}
