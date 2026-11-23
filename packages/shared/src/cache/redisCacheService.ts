import { createHash } from 'node:crypto';
import { getRedisClient } from '../redis.js';
import { CacheStats } from '@seekr/types';

export interface RedisCacheOptions {
  ttlSeconds?: number;
}

export class RedisCacheService {
  private redis = getRedisClient();

  /**
   * Generates a deterministic SHA-256 hash for query normalization.
   */
  public hashKey(input: string): string {
    return createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
  }

  // ============================================================================
  // Level 1: Exact Match Cache (Search & Research Payloads)
  // ============================================================================

  private buildExactKey(cacheType: string, query: string, mode?: string): string {
    const hash = this.hashKey(query);
    const modeKey = mode ? `:${mode.toLowerCase()}` : '';
    return `seekr:cache:exact:${cacheType.toLowerCase()}${modeKey}:${hash}`;
  }

  async getExact<T>(cacheType: string, query: string, mode?: string): Promise<T | null> {
    try {
      const key = this.buildExactKey(cacheType, query, mode);
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      console.warn('[RedisCacheService] Error reading exact cache:', err);
      return null;
    }
  }

  async setExact<T>(
    cacheType: string,
    query: string,
    payload: T,
    options: { mode?: string; ttlSeconds?: number } = {}
  ): Promise<void> {
    try {
      const key = this.buildExactKey(cacheType, query, options.mode);
      const ttl = options.ttlSeconds ?? (cacheType === 'SEARCH' ? 900 : 3600); // 15m for search, 1h for research
      const serialized = JSON.stringify(payload);
      await this.redis.set(key, serialized, 'EX', ttl);
    } catch (err) {
      console.warn('[RedisCacheService] Error setting exact cache:', err);
    }
  }

  // ============================================================================
  // Level 3: Dense Vector Embedding Cache (768-dim floats)
  // ============================================================================

  private buildEmbeddingKey(providerName: string, text: string): string {
    const hash = this.hashKey(text);
    return `seekr:cache:emb:${providerName.toLowerCase()}:${hash}`;
  }

  async getEmbedding(providerName: string, text: string): Promise<number[] | null> {
    try {
      const key = this.buildEmbeddingKey(providerName, text);
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as number[];
    } catch (err) {
      console.warn('[RedisCacheService] Error reading embedding cache:', err);
      return null;
    }
  }

  async setEmbedding(
    providerName: string,
    text: string,
    vector: number[],
    ttlSeconds: number = 604800 // Default 7 days
  ): Promise<void> {
    try {
      const key = this.buildEmbeddingKey(providerName, text);
      await this.redis.set(key, JSON.stringify(vector), 'EX', ttlSeconds);
    } catch (err) {
      console.warn('[RedisCacheService] Error setting embedding cache:', err);
    }
  }

  // ============================================================================
  // Metrics & Operational Stats
  // ============================================================================

  async recordHit(type: 'EXACT' | 'SEMANTIC'): Promise<void> {
    try {
      const key = type === 'EXACT' ? 'seekr:cache:stats:exact_hits' : 'seekr:cache:stats:semantic_hits';
      await this.redis.incr(key);
    } catch {
      // non-blocking
    }
  }

  async recordMiss(): Promise<void> {
    try {
      await this.redis.incr('seekr:cache:stats:misses');
    } catch {
      // non-blocking
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const [exactHits, semanticHits, misses] = await Promise.all([
        this.redis.get('seekr:cache:stats:exact_hits'),
        this.redis.get('seekr:cache:stats:semantic_hits'),
        this.redis.get('seekr:cache:stats:misses'),
      ]);

      const eHits = parseInt(exactHits || '0', 10);
      const sHits = parseInt(semanticHits || '0', 10);
      const mCount = parseInt(misses || '0', 10);
      const totalLookups = eHits + sHits + mCount;

      return {
        exactHitCount: eHits,
        semanticHitCount: sHits,
        missCount: mCount,
        totalLookups,
        exactHitRatio: totalLookups > 0 ? parseFloat((eHits / totalLookups).toFixed(4)) : 0,
        semanticHitRatio: totalLookups > 0 ? parseFloat((sHits / totalLookups).toFixed(4)) : 0,
        totalHitRatio: totalLookups > 0 ? parseFloat(((eHits + sHits) / totalLookups).toFixed(4)) : 0,
      };
    } catch (err) {
      console.warn('[RedisCacheService] Error getting cache stats:', err);
      return {
        exactHitCount: 0,
        semanticHitCount: 0,
        missCount: 0,
        totalLookups: 0,
        exactHitRatio: 0,
        semanticHitRatio: 0,
        totalHitRatio: 0,
      };
    }
  }

  async resetStats(): Promise<void> {
    try {
      await this.redis.del(
        'seekr:cache:stats:exact_hits',
        'seekr:cache:stats:semantic_hits',
        'seekr:cache:stats:misses'
      );
    } catch {
      // non-blocking
    }
  }

  // ============================================================================
  // Invalidation
  // ============================================================================

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          const count = await this.redis.del(...keys);
          deletedCount += count;
        }
      } while (cursor !== '0');
      return deletedCount;
    } catch (err) {
      console.warn('[RedisCacheService] Error invalidating pattern:', err);
      return 0;
    }
  }

  async clearAllExact(): Promise<number> {
    return this.invalidatePattern('seekr:cache:exact:*');
  }

  async clearAllEmbeddings(): Promise<number> {
    return this.invalidatePattern('seekr:cache:emb:*');
  }

  async countPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let total = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        total += keys.length;
      } while (cursor !== '0');
      return total;
    } catch {
      return 0;
    }
  }

  async countExact(): Promise<number> {
    return this.countPattern('seekr:cache:exact:*');
  }

  async countEmbeddings(): Promise<number> {
    return this.countPattern('seekr:cache:emb:*');
  }
}
