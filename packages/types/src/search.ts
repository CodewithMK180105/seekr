export type SearchMode = 'KEYWORD' | 'SEMANTIC' | 'HYBRID';

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  title: string;
  url: string;
  content: string;
  score: number;
  rank: number;
  sourceType: string;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  totalResults: number;
  latencyMs: number;
  results: SearchResultItem[];
  page: number;
  limit: number;
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
