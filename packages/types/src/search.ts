export type SearchMode = 'KEYWORD' | 'SEMANTIC' | 'HYBRID';

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  url: string;
  content: string;
  score: number;
  rank: number;
  sourceType: string;
  keywordRank?: number | null;
  vectorRank?: number | null;
  matchedBy?: {
    keyword: boolean;
    vector: boolean;
  };
}

export interface SearchPagination {
  page: number;
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface SearchResponse {
  searchId?: string;
  searchQueryId?: string;
  query: string;
  mode: SearchMode;
  results: SearchResultItem[];
  pagination: SearchPagination;
  latencyMs: number;
  degraded?: boolean;
  degradedReason?: string;
}

export interface SuggestionsResponse {
  query: string;
  suggestions: string[];
}

export interface SearchFeedbackPayload {
  searchId?: string;
  searchQueryId?: string;
  chunkId: string;
  action?: 'click';
  event?: 'click';
}

export interface SearchAnalyticsResponse {
  period?: {
    from: string | null;
    to: string | null;
  };
  totalQueries: number;
  avgLatencyMs: number;
  averageLatencyMs?: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  clickThroughRate: number;
  searchCtr: number;
  resultCtr: number;
  modeDistribution: Record<SearchMode, number>;
  searchModeDistribution: Array<{
    mode: SearchMode;
    count: number;
    percentage: number;
  }>;
  topQueries: Array<{ query: string; count: number }>;
  topClickedDocuments: Array<{
    documentId?: string;
    chunkId?: string;
    title: string;
    url: string;
    clicks: number;
  }>;
  zeroResultQueries: Array<{ query: string; count: number }>;
}

export interface RankedSearchResult {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  title: string;
  url: string;
  sourceType: string;
  rank: number;
  score: number;
  source: 'keyword' | 'vector';
}

export interface FusedSearchResult {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  title: string;
  url: string;
  sourceType: string;
  fusedScore: number;
  keywordRank: number | null;
  vectorRank: number | null;
  matchedBy: {
    keyword: boolean;
    vector: boolean;
  };
}

export interface Retriever {
  readonly name: string;
  search(query: string, limit: number, sourceId?: string): Promise<RankedSearchResult[]>;
}

export interface Citation {
  index: number;
  title: string;
  url: string;
  chunkId: string;
  snippet: string;
}

export interface ResearchResponse {
  query: string;
  answer: string;
  citations: Citation[];
  latencyMs: number;
}
