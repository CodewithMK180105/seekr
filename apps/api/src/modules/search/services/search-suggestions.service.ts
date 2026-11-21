import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@seekr/shared';

export class SearchSuggestionsService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Generates low-latency search autocomplete suggestions from indexed document titles
   * and historical search queries.
   *
   * Rules:
   * - Minimum query length is 2 characters (if < 2, returns [] immediately).
   * - Limit is clamped between 1 and 10 (default 5).
   * - Exact prefix matching (case-insensitive).
   * - Deduplicated case-insensitively.
   * - Fast database queries using indexes without LLM or vector embeddings.
   */
  async getSuggestions(prefix: string, rawLimit: number = 5): Promise<string[]> {
    const cleanPrefix = typeof prefix === 'string' ? prefix.trim() : '';

    // Requirement: minimum query length of 2 characters
    if (cleanPrefix.length < 2) {
      return [];
    }

    // Clamp limit between 1 and 10 (default 5)
    const limit = Math.max(1, Math.min(Math.floor(rawLimit) || 5, 10));

    try {
      // 1. Fetch historical queries matching the prefix using indexed normalized_query
      const normalizedPrefix = cleanPrefix.toLowerCase() + '%';
      const historicalQueriesPromise = this.prisma.$queryRaw<
        Array<{ query: string; count: number }>
      >`
        SELECT query, COUNT(*)::int AS count
        FROM search_queries
        WHERE normalized_query LIKE ${normalizedPrefix}
        GROUP BY query
        ORDER BY count DESC, query ASC
        LIMIT ${limit};
      `.catch((err) => {
        console.warn('[SearchSuggestionsService] Failed to query search history:', err);
        return [] as Array<{ query: string; count: number }>;
      });

      // 2. Fetch indexed document titles matching the prefix
      const documentTitlesPromise = this.prisma.document
        .findMany({
          where: {
            title: {
              startsWith: cleanPrefix,
              mode: 'insensitive',
            },
          },
          select: {
            title: true,
          },
          distinct: ['title'],
          take: limit,
        })
        .then((docs) => docs.map((d) => d.title.trim()).filter(Boolean))
        .catch((err) => {
          console.warn('[SearchSuggestionsService] Failed to query document titles:', err);
          return [] as string[];
        });

      const [historicalQueries, docTitles] = await Promise.all([
        historicalQueriesPromise,
        documentTitlesPromise,
      ]);

      // 3. Merge, rank, and deduplicate case-insensitively
      const seen = new Set<string>();
      const suggestions: string[] = [];

      // Prioritize popular historical queries first (real user intent)
      for (const item of historicalQueries) {
        const text = item.query.trim();
        const lower = text.toLowerCase();
        if (text && !seen.has(lower)) {
          seen.add(lower);
          suggestions.push(text);
          if (suggestions.length >= limit) break;
        }
      }

      // Then add matching document titles
      if (suggestions.length < limit) {
        for (const title of docTitles) {
          const lower = title.toLowerCase();
          if (title && !seen.has(lower)) {
            seen.add(lower);
            suggestions.push(title);
            if (suggestions.length >= limit) break;
          }
        }
      }

      return suggestions;
    } catch (err) {
      console.warn('[SearchSuggestionsService] Error generating suggestions:', err);
      return [];
    }
  }
}
