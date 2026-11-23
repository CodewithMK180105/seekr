import { randomUUID } from 'node:crypto';
import {
  searchRequestsTotal,
  searchZeroResultsTotal,
  searchFailuresTotal,
  searchDurationSeconds,
} from '@seekr/shared';
import {
  SearchMode,
  SearchResponse,
  SearchResultItem,
  RankedSearchResult,
  Retriever,
} from '../search.types.js';
import { KeywordRetrieverService } from './keyword-retriever.service.js';
import { VectorRetrieverService } from './vector-retriever.service.js';
import { RrfRankingService } from './rrf-ranking.service.js';
import { SearchLoggingService } from './search-logging.service.js';
import { SemanticCacheService } from '../../cache/semantic-cache.service.js';

export interface SearchParams {
  query: string;
  mode?: SearchMode;
  page?: number;
  limit?: number;
  sourceId?: string;
  userId?: string;
  sessionId?: string;
  disableLogging?: boolean;
  skipCache?: boolean;
}

/**
 * SearchService
 * 
 * Orchestrates multi-modal retrieval:
 * - KEYWORD: Lexical search with ts_rank_cd cover density ranking.
 * - SEMANTIC: Vector retrieval with pgvector cosine similarity ranking.
 * - HYBRID: Concurrent execution of both retrievers with Reciprocal Rank Fusion (RRF).
 * 
 * Handles:
 * - Post-ranking, post-deduplication pagination.
 * - Metadata formatting (matchedBy, keywordRank, vectorRank).
 * - Graceful degradation if a retriever fails in HYBRID mode.
 * - Asynchronous, non-blocking query logging and click preparation.
 */
export class SearchService {
  private readonly keywordRetriever: Retriever;
  private readonly vectorRetriever: Retriever;
  private readonly rrfService: RrfRankingService;
  private readonly searchLoggingService: SearchLoggingService;
  private readonly semanticCache: SemanticCacheService;

  constructor(
    keywordRetriever: Retriever = new KeywordRetrieverService(),
    vectorRetriever: Retriever = new VectorRetrieverService(),
    rrfService: RrfRankingService = new RrfRankingService(),
    searchLoggingService: SearchLoggingService = new SearchLoggingService(),
    semanticCache: SemanticCacheService = new SemanticCacheService()
  ) {
    this.keywordRetriever = keywordRetriever;
    this.vectorRetriever = vectorRetriever;
    this.rrfService = rrfService;
    this.searchLoggingService = searchLoggingService;
    this.semanticCache = semanticCache;
  }

  /**
   * Execute search across the configured mode.
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchQueryId = randomUUID();

    // 1. Normalize query and pagination parameters
    const cleanQuery = typeof params.query === 'string' ? params.query.trim() : '';
    const mode: SearchMode = params.mode || 'HYBRID';
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(params.limit || 10, 100));
    const offset = (page - 1) * limit;

    // Fast-path: return empty response for empty queries
    if (cleanQuery.length === 0) {
      return {
        searchId: searchQueryId,
        searchQueryId,
        query: cleanQuery,
        mode,
        results: [],
        pagination: {
          page,
          limit,
          offset,
          total: 0,
          hasMore: false,
        },
        latencyMs: Date.now() - startTime,
      };
    }

    // 2. Check Cache (Exact L1 + Semantic L2) for first-page un-scoped queries
    if (!params.skipCache && page === 1 && !params.sourceId) {
      const cacheMatch = await this.semanticCache.findMatch<SearchResultItem[]>({
        cacheType: 'SEARCH',
        query: cleanQuery,
        searchMode: mode,
      });

      if (cacheMatch.matched && cacheMatch.payload) {
        const cachedResults = cacheMatch.payload.slice(0, limit);
        const latencyMs = Date.now() - startTime;

        if (!params.disableLogging) {
          this.searchLoggingService
            .logSearch({
              searchQueryId,
              userId: params.userId,
              sessionId: params.sessionId,
              query: cleanQuery,
              searchMode: mode,
              resultCount: cachedResults.length,
              latencyMs,
              page,
              limit,
              results: cachedResults,
            })
            .catch(() => {});
        }

        searchRequestsTotal.inc({ mode, status: 'success' });
        searchDurationSeconds.observe({ mode }, latencyMs / 1000);
        if (cachedResults.length === 0) {
          searchZeroResultsTotal.inc({ mode });
        }

        return {
          searchId: searchQueryId,
          searchQueryId,
          query: cleanQuery,
          mode,
          results: cachedResults,
          pagination: {
            page: 1,
            limit,
            offset: 0,
            total: cacheMatch.payload.length,
            hasMore: cacheMatch.payload.length > limit,
          },
          latencyMs,
          cached: true,
          cacheType: cacheMatch.matchStrategy,
          cacheSimilarity: cacheMatch.similarity,
        };
      }
    }

    // Determine candidate retrieval depth to ensure accurate ranking prior to pagination
    // Retrieves at least enough candidates to satisfy offset + limit, with a healthy buffer
    const candidateLimit = Math.min(100, Math.max(page * limit + 20, 50));

    let allRankedResults: SearchResultItem[] = [];
    let degraded = false;
    let degradedReason: string | undefined;

    // 2. Execute retrieval according to search mode
    if (mode === 'KEYWORD') {
      try {
        const rawResults = await this.keywordRetriever.search(
          cleanQuery,
          candidateLimit,
          params.sourceId
        );
        allRankedResults = rawResults.map((r, index) => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          chunkIndex: r.chunkIndex,
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          rank: index + 1,
          sourceType: r.sourceType,
          keywordRank: r.rank,
          vectorRank: null,
          matchedBy: {
            keyword: true,
            vector: false,
          },
        }));
      } catch (err) {
        console.error('[SearchService] Keyword retrieval error:', err);
        degraded = true;
        degradedReason = 'Keyword retrieval failed';
      }
    } else if (mode === 'SEMANTIC') {
      try {
        const rawResults = await this.vectorRetriever.search(
          cleanQuery,
          candidateLimit,
          params.sourceId
        );
        allRankedResults = rawResults.map((r, index) => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          chunkIndex: r.chunkIndex,
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          rank: index + 1,
          sourceType: r.sourceType,
          keywordRank: null,
          vectorRank: r.rank,
          matchedBy: {
            keyword: false,
            vector: true,
          },
        }));
      } catch (err) {
        console.error('[SearchService] Semantic retrieval error:', err);
        degraded = true;
        degradedReason = 'Semantic retrieval failed';
      }
    } else {
      // HYBRID mode: Execute keyword and semantic retrievers concurrently
      const [keywordOutcome, vectorOutcome] = await Promise.allSettled([
        this.keywordRetriever.search(cleanQuery, candidateLimit, params.sourceId),
        this.vectorRetriever.search(cleanQuery, candidateLimit, params.sourceId),
      ]);

      let keywordResults: RankedSearchResult[] = [];
      let vectorResults: RankedSearchResult[] = [];

      if (keywordOutcome.status === 'fulfilled') {
        keywordResults = keywordOutcome.value;
      } else {
        console.error('[SearchService] Hybrid: keyword retriever rejected:', keywordOutcome.reason);
        degraded = true;
        degradedReason = 'Keyword retriever failed';
      }

      if (vectorOutcome.status === 'fulfilled') {
        vectorResults = vectorOutcome.value;
      } else {
        console.error('[SearchService] Hybrid: vector retriever rejected:', vectorOutcome.reason);
        degraded = true;
        degradedReason = degradedReason
          ? 'Both retrieval services failed'
          : 'Vector retriever failed';
      }

      // Combine using Reciprocal Rank Fusion
      const fused = this.rrfService.fuse(keywordResults, vectorResults);

      allRankedResults = fused.map((item, index) => ({
        chunkId: item.chunkId,
        documentId: item.documentId,
        chunkIndex: item.chunkIndex,
        title: item.title,
        url: item.url,
        content: item.content,
        score: item.fusedScore,
        rank: index + 1,
        sourceType: item.sourceType,
        keywordRank: item.keywordRank,
        vectorRank: item.vectorRank,
        matchedBy: item.matchedBy,
      }));
    }

    // 3. Post-fusion pagination
    const total = allRankedResults.length;
    const pagedResults = allRankedResults.slice(offset, offset + limit);
    const hasMore = offset + pagedResults.length < total;
    const latencyMs = Date.now() - startTime;

    const response: SearchResponse = {
      searchId: searchQueryId,
      searchQueryId,
      query: cleanQuery,
      mode,
      results: pagedResults,
      pagination: {
        page,
        limit,
        offset,
        total,
        hasMore,
      },
      latencyMs,
      ...(degraded ? { degraded: true, degradedReason } : {}),
    };

    // Non-blocking asynchronous query & results logging (skipped if disableLogging is true)
    if (!params.disableLogging) {
      this.searchLoggingService
        .logSearch({
          searchQueryId,
          userId: params.userId,
          sessionId: params.sessionId,
          query: cleanQuery,
          searchMode: mode,
          resultCount: total,
          latencyMs,
          page,
          limit,
          results: pagedResults,
        })
        .catch((err) => {
          console.warn('[SearchService] Async logging dispatch error:', err);
        });
    }

    // Populate cache asynchronously for first-page un-scoped non-degraded queries if results exist
    if (!params.skipCache && !degraded && page === 1 && !params.sourceId && pagedResults.length > 0) {
      this.semanticCache
        .store({
          cacheType: 'SEARCH',
          query: cleanQuery,
          searchMode: mode,
          payload: pagedResults,
        })
        .catch(() => {});
    }

    searchRequestsTotal.inc({ mode, status: degraded ? 'degraded' : 'success' });
    searchDurationSeconds.observe({ mode }, latencyMs / 1000);
    if (pagedResults.length === 0) {
      searchZeroResultsTotal.inc({ mode });
    }
    if (degraded) {
      searchFailuresTotal.inc({ mode, reason: degradedReason || 'retriever_degraded' });
    }

    return response;
  }
}
