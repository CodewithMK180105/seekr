import { SearchMode } from '@seekr/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  title: string;
  url: string;
  sourceType: string;
  score: number;
  rank: number;
  keywordRank?: number | null;
  vectorRank?: number | null;
  matchedBy?: 'KEYWORD' | 'SEMANTIC' | 'HYBRID';
}

export interface SearchResponseData {
  query: string;
  originalQuery?: string;
  queryCategory?: string;
  sufficiencyAction?: string;
  mode: SearchMode;
  latencyMs: number;
  cached?: boolean;
  cacheType?: 'EXACT' | 'SEMANTIC' | string;
  cacheSimilarity?: number;
  dynamicallyCrawled?: boolean;
  queryId: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  results: SearchResultItem[];
}

export interface SuggestionItem {
  text: string;
  source: 'title' | 'history';
}

export interface SearchSuggestionsData {
  query: string;
  suggestions: SuggestionItem[];
}

export interface SearchAnalyticsData {
  totalQueries: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  searchCtr: number;
  resultCtr: number;
  modeDistribution?: Record<
    string,
    number | { count: number; percentage: number }
  >;
  searchModeDistribution?: Array<{
    mode: string;
    count: number;
    percentage: number;
  }>;
  topQueries: Array<{ query: string; count: number; lastSearched?: string }>;
  topClickedDocuments: Array<{
    documentId: string;
    title: string;
    url: string;
    clicks: number;
  }>;
  zeroResultQueries?: Array<{
    query: string;
    count: number;
    lastSearched?: string;
  }>;
}

export interface SystemHealthData {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version?: string;
}

/**
 * Execute a hybrid, semantic, or keyword search query.
 */
export async function executeSearch(params: {
  q: string;
  mode?: SearchMode;
  page?: number;
  limit?: number;
  sourceId?: string;
}): Promise<SearchResponseData> {
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q);
  if (params.mode) queryParams.set('mode', params.mode);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.sourceId) queryParams.set('sourceId', params.sourceId);

  const res = await fetch(`${API_BASE_URL}/api/v1/search?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body?.error?.message || `Search failed with HTTP ${res.status}`);
  }

  return body.data;
}

export interface ProgressiveSearchCallbacks {
  onPhase?: (phase: string, message: string) => void;
  onLocalResults?: (data: SearchResponseData) => void;
  onNewResults?: (data: SearchResponseData) => void;
  onComplete?: (data: SearchResponseData) => void;
  onError?: (err: any) => void;
}

/**
 * Execute progressive search via Server-Sent Events (SSE).
 * Delivers immediate local results in <50ms and progressively streams web discovery.
 */
export function executeSearchProgressive(
  params: {
    q: string;
    mode?: SearchMode;
    page?: number;
    limit?: number;
    sourceId?: string;
  },
  callbacks: ProgressiveSearchCallbacks
): () => void {
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q);
  if (params.mode) queryParams.set('mode', params.mode);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.sourceId) queryParams.set('sourceId', params.sourceId);

  const url = `${API_BASE_URL}/api/v1/search/stream?${queryParams.toString()}`;
  let eventSource: EventSource | null = null;
  let isCompleted = false;

  try {
    eventSource = new EventSource(url);

    eventSource.addEventListener('search_event', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'PHASE') {
          callbacks.onPhase?.(payload.phase, payload.message);
        } else if (payload.type === 'LOCAL_RESULTS') {
          callbacks.onLocalResults?.({
            query: params.q,
            mode: params.mode || 'HYBRID',
            latencyMs: 50,
            queryId: 'local',
            pagination: {
              page: params.page || 1,
              limit: params.limit || 10,
              total: payload.total,
              totalPages: Math.max(1, Math.ceil(payload.total / (params.limit || 10))),
              hasMore: payload.total > (params.limit || 10),
            },
            results: payload.results,
          });
        } else if (payload.type === 'COMPLETE') {
          isCompleted = true;
          callbacks.onComplete?.(payload.response);
        }
      } catch {}
    });

    eventSource.addEventListener('end', () => {
      eventSource?.close();
    });

    eventSource.onerror = (err) => {
      eventSource?.close();
      if (!isCompleted) {
        // Fall back seamlessly to standard fetch
        executeSearch(params)
          .then((res) => {
            callbacks.onComplete?.(res);
          })
          .catch((fallbackErr) => {
            callbacks.onError?.(fallbackErr);
          });
      }
    };
  } catch {
    executeSearch(params)
      .then((res) => callbacks.onComplete?.(res))
      .catch((err) => callbacks.onError?.(err));
  }

  return () => {
    eventSource?.close();
  };
}

/**
 * Fetch prefix autocomplete suggestions.
 */
export async function fetchSuggestions(query: string, limit = 6): Promise<SuggestionItem[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const queryParams = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
  });

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/search/suggestions?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) return [];
    const body = await res.json();
    return body?.data?.suggestions || [];
  } catch (err) {
    console.warn('[api] Failed to fetch suggestions:', err);
    return [];
  }
}

/**
 * Track user clicks on search results for CTR analytics (non-blocking).
 */
export async function recordSearchClick(params: {
  queryId: string;
  resultChunkId: string;
  clickedRank: number;
}): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/search/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      keepalive: true,
    });
  } catch (err) {
    // Non-blocking telemetry
    console.debug('[api] Click feedback tracking failed silently:', err);
  }
}

/**
 * Fetch search engine aggregate analytics.
 */
export async function fetchSearchAnalytics(from?: string, to?: string): Promise<SearchAnalyticsData | null> {
  const queryParams = new URLSearchParams();
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);

  try {
    const url = `${API_BASE_URL}/api/v1/search/analytics${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body?.data || null;
  } catch (err) {
    console.warn('[api] Failed to fetch analytics:', err);
    return null;
  }
}

/**
 * Fetch system health status.
 */
export async function fetchSystemHealth(): Promise<SystemHealthData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body?.data || { status: 'ok', timestamp: new Date().toISOString(), uptime: 0 };
  } catch {
    return null;
  }
}
