import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';

export class SerpApiSearchProvider implements SearchProvider {
  readonly name = 'serpapi';
  readonly isExternalSearchEngine = true;

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_API_KEY;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, options?: SearchProviderOptions): Promise<SearchProviderCandidate[]> {
    if (!this.isAvailable()) return [];

    const limit = Math.max(1, Math.min(options?.maxResults || 5, 10));
    const timeoutMs = options?.timeoutMs || 8000;
    const endpoint = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
      query
    )}&api_key=${encodeURIComponent(this.apiKey!)}&num=${limit}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': options?.userAgent || 'SeekrBot/1.0',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[SerpApiSearchProvider] HTTP error: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as any;
      const organic = data.organic_results;
      if (!Array.isArray(organic)) return [];

      const candidates: SearchProviderCandidate[] = [];
      organic.slice(0, limit).forEach((item: any, idx: number) => {
        if (!item.link) return;
        let domain: string | undefined;
        try {
          domain = new URL(item.link).hostname.replace(/^www\./, '');
        } catch {}

        candidates.push({
          url: item.link,
          title: item.title || domain || 'Web Result',
          snippet: item.snippet || undefined,
          provider: this.name,
          rank: idx + 1,
          domain,
          publishedDate: item.date,
          relevanceScore: Math.max(0.1, 1 - idx * 0.08),
        });
      });

      return candidates;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[SerpApiSearchProvider] Request timed out after ${timeoutMs}ms`);
      } else {
        console.warn('[SerpApiSearchProvider] Request failed:', err.message || err);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
