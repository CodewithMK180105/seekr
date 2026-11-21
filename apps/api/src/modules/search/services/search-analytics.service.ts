import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@seekr/shared';
import { SearchAnalyticsResponse, SearchMode } from '../search.types.js';

export interface AnalyticsDateFilter {
  from?: Date;
  to?: Date;
}

export class SearchAnalyticsService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Aggregate search analytics over an optional time window using efficient
   * database-level aggregations and percentiles.
   */
  async getAnalytics(filter?: AnalyticsDateFilter): Promise<SearchAnalyticsResponse> {
    const from = filter?.from ?? null;
    const to = filter?.to ?? null;

    // 1. Overall query overview & latency percentiles
    const overviewPromise = this.prisma.$queryRaw<
      Array<{
        totalQueries: number;
        avgLatencyMs: number;
        p50LatencyMs: number;
        p95LatencyMs: number;
        keywordCount: number;
        semanticCount: number;
        hybridCount: number;
        zeroResultCount: number;
      }>
    >`
      SELECT
        COUNT(*)::int AS "totalQueries",
        COALESCE(AVG(latency_ms), 0)::float AS "avgLatencyMs",
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::float AS "p50LatencyMs",
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::float AS "p95LatencyMs",
        COUNT(CASE WHEN search_mode = 'KEYWORD' THEN 1 END)::int AS "keywordCount",
        COUNT(CASE WHEN search_mode = 'SEMANTIC' THEN 1 END)::int AS "semanticCount",
        COUNT(CASE WHEN search_mode = 'HYBRID' THEN 1 END)::int AS "hybridCount",
        COUNT(CASE WHEN result_count = 0 THEN 1 END)::int AS "zeroResultCount"
      FROM search_queries
      WHERE (${from}::timestamp IS NULL OR created_at >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR created_at <= ${to}::timestamp);
    `;

    // 2. Impressions & click CTR metrics
    const ctrPromise = this.prisma.$queryRaw<
      Array<{
        totalImpressions: number;
        totalClicks: number;
        clickedSearches: number;
      }>
    >`
      SELECT
        COUNT(*)::int AS "totalImpressions",
        COUNT(CASE WHEN sr.clicked THEN 1 END)::int AS "totalClicks",
        COUNT(DISTINCT CASE WHEN sr.clicked THEN sr.search_query_id END)::int AS "clickedSearches"
      FROM search_results sr
      JOIN search_queries sq ON sq.id = sr.search_query_id
      WHERE (${from}::timestamp IS NULL OR sq.created_at >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR sq.created_at <= ${to}::timestamp);
    `;

    // 3. Top frequent search queries
    const topQueriesPromise = this.prisma.$queryRaw<
      Array<{ query: string; count: number }>
    >`
      SELECT query, COUNT(*)::int AS count
      FROM search_queries
      WHERE (${from}::timestamp IS NULL OR created_at >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR created_at <= ${to}::timestamp)
      GROUP BY query
      ORDER BY count DESC, query ASC
      LIMIT 10;
    `;

    // 4. Queries yielding zero results
    const zeroResultQueriesPromise = this.prisma.$queryRaw<
      Array<{ query: string; count: number }>
    >`
      SELECT query, COUNT(*)::int AS count
      FROM search_queries
      WHERE result_count = 0
        AND (${from}::timestamp IS NULL OR created_at >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR created_at <= ${to}::timestamp)
      GROUP BY query
      ORDER BY count DESC, query ASC
      LIMIT 10;
    `;

    // 5. Top clicked documents / chunks
    const topClickedDocumentsPromise = this.prisma.$queryRaw<
      Array<{
        documentId: string;
        chunkId: string;
        title: string;
        url: string;
        clicks: number;
      }>
    >`
      SELECT
        d.id AS "documentId",
        c.id AS "chunkId",
        d.title,
        d.url,
        COUNT(sr.id)::int AS clicks
      FROM search_results sr
      JOIN document_chunks c ON c.id = sr.chunk_id
      JOIN documents d ON d.id = c.document_id
      JOIN search_queries sq ON sq.id = sr.search_query_id
      WHERE sr.clicked = TRUE
        AND (${from}::timestamp IS NULL OR sq.created_at >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR sq.created_at <= ${to}::timestamp)
      GROUP BY d.id, c.id, d.title, d.url
      ORDER BY clicks DESC, d.title ASC
      LIMIT 10;
    `;

    const [overviewRows, ctrRows, topQueries, zeroResultQueries, topClickedDocuments] =
      await Promise.all([
        overviewPromise,
        ctrPromise,
        topQueriesPromise,
        zeroResultQueriesPromise,
        topClickedDocumentsPromise,
      ]);

    const overview = overviewRows[0] || {
      totalQueries: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      keywordCount: 0,
      semanticCount: 0,
      hybridCount: 0,
      zeroResultCount: 0,
    };

    const ctr = ctrRows[0] || {
      totalImpressions: 0,
      totalClicks: 0,
      clickedSearches: 0,
    };

    const totalQueries = overview.totalQueries || 0;
    const avgLatencyMs = Number(overview.avgLatencyMs.toFixed(2));
    const p50LatencyMs = Number(overview.p50LatencyMs.toFixed(2));
    const p95LatencyMs = Number(overview.p95LatencyMs.toFixed(2));

    // Search CTR = (searches with >= 1 clicked result / total searches) * 100
    const searchCtr =
      totalQueries > 0 ? Number(((ctr.clickedSearches / totalQueries) * 100).toFixed(2)) : 0;

    // Result CTR = (total clicks / total impressions) * 100
    const resultCtr =
      ctr.totalImpressions > 0
        ? Number(((ctr.totalClicks / ctr.totalImpressions) * 100).toFixed(2))
        : 0;

    const modeDistribution: Record<SearchMode, number> = {
      HYBRID: overview.hybridCount || 0,
      KEYWORD: overview.keywordCount || 0,
      SEMANTIC: overview.semanticCount || 0,
    };

    const searchModeDistribution: Array<{ mode: SearchMode; count: number; percentage: number }> = [
      {
        mode: 'HYBRID',
        count: modeDistribution.HYBRID,
        percentage:
          totalQueries > 0
            ? Number(((modeDistribution.HYBRID / totalQueries) * 100).toFixed(2))
            : 0,
      },
      {
        mode: 'KEYWORD',
        count: modeDistribution.KEYWORD,
        percentage:
          totalQueries > 0
            ? Number(((modeDistribution.KEYWORD / totalQueries) * 100).toFixed(2))
            : 0,
      },
      {
        mode: 'SEMANTIC',
        count: modeDistribution.SEMANTIC,
        percentage:
          totalQueries > 0
            ? Number(((modeDistribution.SEMANTIC / totalQueries) * 100).toFixed(2))
            : 0,
      },
    ];

    return {
      period: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      totalQueries,
      avgLatencyMs,
      averageLatencyMs: avgLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      searchCtr,
      resultCtr,
      clickThroughRate: searchCtr,
      modeDistribution,
      searchModeDistribution,
      topQueries,
      topClickedDocuments,
      zeroResultQueries,
    };
  }
}
