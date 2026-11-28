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
import { dynamicCrawlerService } from '../../crawler/dynamic-crawler.service.js';
import { queryUnderstandingService, ParsedQuery } from './query-understanding.service.js';
import { searchSufficiencyService, SearchSufficiencyService } from './search-sufficiency.service.js';

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

export type SearchProgressiveEvent =
  | { type: 'PHASE'; phase: 'LOCAL' | 'DISCOVERY' | 'INDEXING' | 'COMPLETE'; message: string }
  | { type: 'LOCAL_RESULTS'; results: SearchResultItem[]; total: number; sufficiencyAction: string }
  | { type: 'DISCOVERY_UPDATE'; message: string }
  | { type: 'NEW_RESULTS'; newItems: SearchResultItem[]; total: number }
  | { type: 'COMPLETE'; response: SearchResponse };

export function isLikelyGibberish(query: string): boolean {
  return queryUnderstandingService.detectGibberish(query);
}

export function applyMultiSignalReranking(
  items: SearchResultItem[],
  parsedQuery: ParsedQuery
): SearchResultItem[] {
  if (items.length === 0) return [];

  const keywords = parsedQuery.coreKeywords;
  const entity = parsedQuery.entityCandidate?.toLowerCase();

  return items
    .map((item) => {
      let boostedScore = Number(item.score) || 0;
      const lowerTitle = (item.title || '').toLowerCase();
      const lowerContent = (item.content || '').toLowerCase();

      // Signal 1: Title Relevance Boost
      if (entity && entity.length >= 2 && lowerTitle.includes(entity)) {
        boostedScore += 0.08;
      } else if (keywords.length > 0) {
        let matchedKw = 0;
        for (const kw of keywords) {
          if (lowerTitle.includes(kw)) matchedKw++;
        }
        const titleOverlap = matchedKw / keywords.length;
        boostedScore += titleOverlap * 0.05;
      }

      // Signal 2: Content Structure Quality
      if (lowerContent.includes('```') || lowerContent.includes('parameters') || lowerContent.includes('example')) {
        boostedScore += 0.02;
      }

      // Signal 3: Freshness Boost (ONLY if explicitly requested by query)
      if (parsedQuery.requiresFreshness) {
        const text = `${lowerTitle} ${lowerContent}`;
        if (text.includes('2026') || text.includes('2025') || text.includes('latest') || text.includes('v2.')) {
          boostedScore += 0.05;
        }
      }

      return {
        ...item,
        score: boostedScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function applyDiversityControls(items: SearchResultItem[], maxPerDomainInTop = 2): SearchResultItem[] {
  if (items.length <= 3) return items;

  const domainCounts = new Map<string, number>();
  const primary: SearchResultItem[] = [];
  const deferred: SearchResultItem[] = [];

  for (const item of items) {
    let domain = 'web';
    try {
      domain = new URL(item.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {}

    const count = domainCounts.get(domain) || 0;
    if (count < maxPerDomainInTop) {
      domainCounts.set(domain, count + 1);
      primary.push(item);
    } else {
      deferred.push(item);
    }
  }

  return [...primary, ...deferred];
}

export function deduplicateByDocument(items: SearchResultItem[]): SearchResultItem[] {
  const seenDocs = new Set<string>();
  const uniqueResults: SearchResultItem[] = [];

  for (const item of items) {
    const key = item.documentId || item.url;
    if (seenDocs.has(key)) continue;
    seenDocs.add(key);
    uniqueResults.push(item);
  }

  return uniqueResults;
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
 * - Query understanding and intent classification.
 * - Post-ranking, post-deduplication pagination.
 * - Search sufficiency policy triggering dynamic web crawls.
 * - Multi-signal title and quality reranking.
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
  private readonly dynamicCrawler: typeof dynamicCrawlerService;
  private readonly sufficiencyService: SearchSufficiencyService;

  constructor(
    keywordRetriever: Retriever = new KeywordRetrieverService(),
    vectorRetriever: Retriever = new VectorRetrieverService(),
    rrfService: RrfRankingService = new RrfRankingService(),
    searchLoggingService: SearchLoggingService = new SearchLoggingService(),
    semanticCache: SemanticCacheService = new SemanticCacheService(),
    dynamicCrawler: typeof dynamicCrawlerService = dynamicCrawlerService,
    sufficiencyService: SearchSufficiencyService = searchSufficiencyService
  ) {
    this.keywordRetriever = keywordRetriever;
    this.vectorRetriever = vectorRetriever;
    this.rrfService = rrfService;
    this.searchLoggingService = searchLoggingService;
    this.semanticCache = semanticCache;
    this.dynamicCrawler = dynamicCrawler;
    this.sufficiencyService = sufficiencyService;
  }

  /**
   * Execute search across the configured mode with optional progressive event dispatching.
   */
  async search(
    params: SearchParams,
    onProgress?: (event: SearchProgressiveEvent) => void
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchQueryId = randomUUID();

    // 1. Parse and understand query
    const cleanQuery = typeof params.query === 'string' ? params.query.trim() : '';
    const mode: SearchMode = params.mode || 'HYBRID';
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(params.limit || 10, 100));
    const offset = (page - 1) * limit;

    // Fast-path: return empty response for empty queries
    if (cleanQuery.length === 0) {
      const emptyRes: SearchResponse = {
        searchId: searchQueryId,
        searchQueryId,
        query: cleanQuery,
        originalQuery: cleanQuery,
        queryCategory: 'GIBBERISH',
        mode,
        results: [],
        pagination: {
          page,
          limit,
          offset,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
        latencyMs: Date.now() - startTime,
      };
      onProgress?.({ type: 'COMPLETE', response: emptyRes });
      return emptyRes;
    }

    const parsedQuery = queryUnderstandingService.parseQuery(cleanQuery);

    // Fast-path: reject gibberish immediately without database or network strain
    if (parsedQuery.isGibberish) {
      const gibberishRes: SearchResponse = {
        searchId: searchQueryId,
        searchQueryId,
        query: cleanQuery,
        originalQuery: parsedQuery.originalQuery,
        queryCategory: 'GIBBERISH',
        sufficiencyAction: 'REJECT_GIBBERISH',
        mode,
        results: [],
        pagination: {
          page,
          limit,
          offset,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
        latencyMs: Date.now() - startTime,
      };
      onProgress?.({ type: 'COMPLETE', response: gibberishRes });
      return gibberishRes;
    }

    // Use cleaned query for retrieval engines to strip conversational prefixes
    const retrievalQuery = parsedQuery.cleanedQuery || cleanQuery;

    onProgress?.({
      type: 'PHASE',
      phase: 'LOCAL',
      message: 'Searching indexed technical library...',
    });

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

    // 2. Execute retrieval according to search mode using normalized retrieval query
    if (mode === 'KEYWORD') {
      try {
        const rawResults = await this.keywordRetriever.search(
          retrievalQuery,
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
          retrievalQuery,
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
        this.keywordRetriever.search(retrievalQuery, candidateLimit, params.sourceId),
        this.vectorRetriever.search(retrievalQuery, candidateLimit, params.sourceId),
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

    // 3. Multi-Signal Reranking (Title Match, Content Quality, Query-intent Freshness)
    let rerankedResults = applyMultiSignalReranking(allRankedResults, parsedQuery);
    const initialUniqueDocs = deduplicateByDocument(rerankedResults);

    // 4. Search Sufficiency Evaluation:
    // Determine whether retrieved results sufficiently answer the query, or if dynamic web discovery is needed
    const sufficiency = this.sufficiencyService.evaluateSufficiency(
      initialUniqueDocs,
      parsedQuery,
      Boolean(params.sourceId)
    );

    // Progressive callback: Dispatch immediate local results
    onProgress?.({
      type: 'LOCAL_RESULTS',
      results: initialUniqueDocs.slice(offset, offset + limit),
      total: initialUniqueDocs.length,
      sufficiencyAction: sufficiency.action,
    });

    let dynamicallyCrawled = false;
    if (sufficiency.action === 'TRIGGER_WEB_DISCOVERY') {
      try {
        console.log(`[SearchService] Sufficiency policy triggered web discovery: ${sufficiency.reason}`);
        onProgress?.({
          type: 'PHASE',
          phase: 'DISCOVERY',
          message: `Expanding search: discovering verified web sources for "${retrievalQuery}"...`,
        });

        const crawledItems = await this.dynamicCrawler.crawlForQuery(retrievalQuery, {
          maxPages: sufficiency.targetDiscoveryCount,
        });
        if (crawledItems.length > 0) {
          allRankedResults = [...allRankedResults, ...crawledItems];
          dynamicallyCrawled = true;
          rerankedResults = applyMultiSignalReranking(allRankedResults, parsedQuery);

          onProgress?.({
            type: 'NEW_RESULTS',
            newItems: crawledItems,
            total: deduplicateByDocument(rerankedResults).length,
          });
        }
      } catch (crawlErr) {
        console.warn('[SearchService] Dynamic web crawl error:', crawlErr);
      }
    }

    // 5. Document-Level Deduplication & Diversity:
    // A single document must not appear multiple times simply because it has multiple matching chunks.
    // Deduplicate by canonical document ID / URL, then apply domain diversity controls.
    const uniqueDocs = deduplicateByDocument(rerankedResults);
    const diverseResults = applyDiversityControls(uniqueDocs);

    // Re-index ranks monotonically
    const finalRankedResults = diverseResults.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    const total = finalRankedResults.length;
    const pagedResults = finalRankedResults.slice(offset, offset + limit);
    const hasMore = offset + pagedResults.length < total;
    const latencyMs = Date.now() - startTime;

    const response: SearchResponse = {
      searchId: searchQueryId,
      searchQueryId,
      query: cleanQuery,
      originalQuery: parsedQuery.originalQuery,
      queryCategory: parsedQuery.category,
      sufficiencyAction: sufficiency.action,
      mode,
      results: pagedResults,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasMore,
      },
      latencyMs,
      ...(dynamicallyCrawled ? { dynamicallyCrawled: true } : {}),
      ...(degraded ? { degraded: true, degradedReason } : {}),
    };

    onProgress?.({
      type: 'COMPLETE',
      response,
    });

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
      Promise.resolve(
        this.semanticCache.store({
          cacheType: 'SEARCH',
          query: cleanQuery,
          searchMode: mode,
          payload: pagedResults,
        })
      ).catch(() => {});
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
