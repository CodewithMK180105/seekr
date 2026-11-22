export type CacheType = 'SEARCH' | 'RESEARCH';
export type CacheMatchStrategy = 'EXACT' | 'SEMANTIC';

export interface CacheEntry<T = unknown> {
  id: string;
  cacheType: CacheType;
  query: string;
  normalizedQuery: string;
  searchMode?: string;
  payload: T;
  hitCount: number;
  similarity?: number;
  lastAccessedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface SemanticCacheMatch<T = unknown> {
  matched: boolean;
  matchStrategy?: CacheMatchStrategy;
  similarity?: number;
  query?: string;
  payload?: T;
  hitCount?: number;
  cacheId?: string;
}

export interface CacheOptions {
  ttlSeconds?: number;
  similarityThreshold?: number;
  skipCache?: boolean;
}

export interface CacheStats {
  exactHitCount: number;
  semanticHitCount: number;
  missCount: number;
  totalLookups: number;
  exactHitRatio: number;
  semanticHitRatio: number;
  totalHitRatio: number;
  activeEntriesCount?: number;
}
