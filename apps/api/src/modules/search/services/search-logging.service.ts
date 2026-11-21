import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@seekr/shared';
import { SearchMode, SearchResultItem } from '../search.types.js';

export interface SearchLogEvent {
  searchQueryId: string;
  userId?: string | null;
  sessionId?: string | null;
  query: string;
  searchMode: SearchMode;
  resultCount: number;
  latencyMs: number;
  page: number;
  limit: number;
  results?: SearchResultItem[];
}

export class SearchLoggingService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Asynchronously log a search query and its returned top results.
   * This is designed to be non-blocking and will never throw to the caller.
   */
  async logSearch(event: SearchLogEvent): Promise<void> {
    try {
      const cleanQuery = event.query.trim();
      if (!cleanQuery) return;

      const normalizedQuery = cleanQuery.toLowerCase();
      const resultsToLog = (event.results || []).slice(0, Math.min(event.limit || 10, 10));

      await this.prisma.searchQuery.create({
        data: {
          id: event.searchQueryId,
          userId: event.userId ?? null,
          sessionId: event.sessionId ?? null,
          query: cleanQuery,
          normalizedQuery,
          searchMode: event.searchMode,
          resultCount: event.resultCount,
          latencyMs: Math.max(0, Math.round(event.latencyMs)),
          page: event.page,
          limit: event.limit,
          results:
            resultsToLog.length > 0
              ? {
                  createMany: {
                    data: resultsToLog.map((item) => ({
                      chunkId: item.chunkId,
                      resultRank: item.rank,
                      fusedScore: item.score,
                      clicked: false,
                    })),
                  },
                }
              : undefined,
        },
      });
    } catch (err) {
      console.warn('[SearchLoggingService] Failed to log search:', err);
    }
  }
}
