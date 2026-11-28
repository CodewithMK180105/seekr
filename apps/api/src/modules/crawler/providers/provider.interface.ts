export interface SearchProviderCandidate {
  url: string;
  title: string;
  snippet?: string;
  provider: string;
  rank: number;
  domain?: string;
  publishedDate?: string;
  relevanceScore?: number;
}

export interface SearchProviderOptions {
  timeoutMs?: number;
  maxResults?: number;
  userAgent?: string;
}

export interface SearchProvider {
  readonly name: string;
  readonly isExternalSearchEngine: boolean;
  isAvailable(): boolean;
  search(query: string, options?: SearchProviderOptions): Promise<SearchProviderCandidate[]>;
}
