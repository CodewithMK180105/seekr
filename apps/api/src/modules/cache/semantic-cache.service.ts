import { prisma, RedisCacheService, getEmbeddingProvider } from '@seekr/shared';
import { CacheType, SemanticCacheMatch, CacheStats } from '@seekr/types';
import { config } from '../../config/index.js';

export interface FindCacheParams {
  cacheType: CacheType;
  query: string;
  searchMode?: string;
  embedding?: number[];
  similarityThreshold?: number;
  skipCache?: boolean;
}

export interface StoreCacheParams<T = unknown> {
  cacheType: CacheType;
  query: string;
  searchMode?: string;
  embedding?: number[];
  payload: T;
  ttlSeconds?: number;
}

export class SemanticCacheService {
  private redisCache: RedisCacheService;
  public readonly defaultSearchThreshold: number = config.SEMANTIC_CACHE_SEARCH_THRESHOLD;
  public readonly defaultResearchThreshold: number = config.SEMANTIC_CACHE_RESEARCH_THRESHOLD;
  public readonly defaultSearchTtl: number = config.CACHE_SEARCH_TTL_SECONDS;
  public readonly defaultResearchTtl: number = config.CACHE_RESEARCH_TTL_SECONDS;

  constructor(redisCache: RedisCacheService = new RedisCacheService()) {
    this.redisCache = redisCache;
  }

  /**
   * Normalizes query string for exact key matching.
   */
  public normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Finds a cached response:
   * 1. Checks L1 Redis exact match (< 1ms).
   * 2. Checks L2 PostgreSQL pgvector semantic similarity (< 5ms).
   */
  async findMatch<T>(params: FindCacheParams): Promise<SemanticCacheMatch<T>> {
    if (params.skipCache) {
      return { matched: false };
    }

    const normalized = this.normalizeQuery(params.query);
    if (!normalized) {
      return { matched: false };
    }

    // --------------------------------------------------------------------------
    // 1. Level 1: Redis Exact Match Cache
    // --------------------------------------------------------------------------
    const exactHit = await this.redisCache.getExact<T>(
      params.cacheType,
      normalized,
      params.searchMode
    );

    if (exactHit) {
      // Non-blocking metric increment
      this.redisCache.recordHit('EXACT').catch(() => {});
      return {
        matched: true,
        matchStrategy: 'EXACT',
        similarity: 1.0,
        query: params.query,
        payload: exactHit,
      };
    }

    // --------------------------------------------------------------------------
    // 2. Level 2: PostgreSQL pgvector Semantic Similarity Cache
    // --------------------------------------------------------------------------
    try {
      // Resolve vector: either passed in or generated via cached embedding provider
      let vector = params.embedding;
      if (!vector || vector.length === 0) {
        const provider = getEmbeddingProvider();
        vector = await provider.embedText(normalized);
      }

      if (!vector || vector.length === 0) {
        await this.redisCache.recordMiss();
        return { matched: false };
      }

      const threshold =
        params.similarityThreshold ??
        (params.cacheType === 'SEARCH'
          ? this.defaultSearchThreshold
          : this.defaultResearchThreshold);

      const vectorString = `[${vector.join(',')}]`;

      // HNSW Cosine Similarity Query: (1 - cosine_distance) >= threshold
      let rows: any[];
      if (params.searchMode) {
        rows = await prisma.$queryRaw<any[]>`
          SELECT 
            id,
            query,
            normalized_query,
            search_mode,
            payload,
            hit_count,
            expires_at,
            (1 - (embedding <=> ${vectorString}::vector)) AS similarity
          FROM semantic_cache
          WHERE cache_type = ${params.cacheType}
            AND expires_at > NOW()
            AND (search_mode = ${params.searchMode} OR search_mode IS NULL)
            AND (1 - (embedding <=> ${vectorString}::vector)) >= ${threshold}
          ORDER BY embedding <=> ${vectorString}::vector ASC
          LIMIT 1;
        `;
      } else {
        rows = await prisma.$queryRaw<any[]>`
          SELECT 
            id,
            query,
            normalized_query,
            search_mode,
            payload,
            hit_count,
            expires_at,
            (1 - (embedding <=> ${vectorString}::vector)) AS similarity
          FROM semantic_cache
          WHERE cache_type = ${params.cacheType}
            AND expires_at > NOW()
            AND (1 - (embedding <=> ${vectorString}::vector)) >= ${threshold}
          ORDER BY embedding <=> ${vectorString}::vector ASC
          LIMIT 1;
        `;
      }

      if (rows.length > 0) {
        const match = rows[0];
        const similarity = parseFloat(match.similarity);

        // Async non-blocking hit count update and Redis stats
        Promise.all([
          prisma.$executeRaw`
            UPDATE semantic_cache 
            SET hit_count = hit_count + 1, last_accessed_at = NOW() 
            WHERE id = ${match.id}::uuid
          `,
          this.redisCache.recordHit('SEMANTIC'),
          // Also backfill L1 Redis exact cache so repeated queries hit L1
          this.redisCache.setExact(params.cacheType, normalized, match.payload, {
            mode: params.searchMode,
            ttlSeconds: Math.min(300, Math.round((new Date(match.expires_at).getTime() - Date.now()) / 1000)),
          }),
        ]).catch((err) => {
          console.warn('[SemanticCacheService] Async update error on cache hit:', err);
        });

        return {
          matched: true,
          matchStrategy: 'SEMANTIC',
          similarity,
          query: match.query,
          payload: match.payload as T,
          hitCount: match.hit_count + 1,
          cacheId: match.id,
        };
      }
    } catch (err) {
      console.warn('[SemanticCacheService] Semantic cache lookup error:', err);
    }

    // Cache miss
    await this.redisCache.recordMiss().catch(() => {});
    return { matched: false };
  }

  /**
   * Stores a generated search or research response in both L1 (Redis) and L2 (pgvector).
   */
  async store<T>(params: StoreCacheParams<T>): Promise<void> {
    const normalized = this.normalizeQuery(params.query);
    if (!normalized) return;

    const ttlSeconds =
      params.ttlSeconds ??
      (params.cacheType === 'SEARCH' ? this.defaultSearchTtl : this.defaultResearchTtl);

    // 1. Store in L1 Redis Exact Cache
    this.redisCache
      .setExact(params.cacheType, normalized, params.payload, {
        mode: params.searchMode,
        ttlSeconds,
      })
      .catch((err) => {
        console.warn('[SemanticCacheService] Failed to set L1 exact cache:', err);
      });

    // 2. Store in L2 PostgreSQL Semantic Cache
    try {
      let vector = params.embedding;
      if (!vector || vector.length === 0) {
        const provider = getEmbeddingProvider();
        vector = await provider.embedText(normalized);
      }

      if (!vector || vector.length === 0) return;

      const vectorString = `[${vector.join(',')}]`;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const payloadJson = JSON.stringify(params.payload);

      await prisma.$executeRaw`
        INSERT INTO semantic_cache (
          id,
          cache_type,
          query,
          normalized_query,
          search_mode,
          embedding,
          payload,
          hit_count,
          last_accessed_at,
          expires_at,
          created_at
        ) VALUES (
          gen_random_uuid(),
          ${params.cacheType},
          ${params.query},
          ${normalized},
          ${params.searchMode || null},
          ${vectorString}::vector,
          ${payloadJson}::jsonb,
          1,
          NOW(),
          ${expiresAt},
          NOW()
        );
      `;
    } catch (err) {
      console.warn('[SemanticCacheService] Failed to store in semantic cache:', err);
    }
  }

  /**
   * Clears expired semantic cache entries from PostgreSQL.
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM semantic_cache WHERE expires_at <= NOW();
      `;
      return Number(result);
    } catch (err) {
      console.warn('[SemanticCacheService] Error cleaning up expired cache entries:', err);
      return 0;
    }
  }

  /**
   * Invalidate cache entries by type or purge all.
   */
  async invalidate(cacheType?: CacheType): Promise<{ exactDeleted: number; semanticDeleted: number }> {
    let exactDeleted = 0;
    let semanticDeleted = 0;

    try {
      if (cacheType) {
        exactDeleted = await this.redisCache.invalidatePattern(`seekr:cache:exact:${cacheType.toLowerCase()}*`);
        const result = await prisma.$executeRaw`
          DELETE FROM semantic_cache WHERE cache_type = ${cacheType};
        `;
        semanticDeleted = Number(result);
      } else {
        exactDeleted = await this.redisCache.clearAllExact();
        const result = await prisma.$executeRaw`
          DELETE FROM semantic_cache;
        `;
        semanticDeleted = Number(result);
      }
    } catch (err) {
      console.warn('[SemanticCacheService] Invalidation error:', err);
    }

    return { exactDeleted, semanticDeleted };
  }

  /**
   * Returns cache stats aggregating Redis and PostgreSQL state.
   */
  async getStats(): Promise<CacheStats> {
    const stats = await this.redisCache.getStats();
    try {
      const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM semantic_cache WHERE expires_at > NOW();
      `;
      if (countResult.length > 0) {
        stats.activeEntriesCount = Number(countResult[0].count);
      }
    } catch {
      // non-blocking
    }
    return stats;
  }
}
