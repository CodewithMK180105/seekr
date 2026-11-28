import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  readonly isExternalSearchEngine = true;

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, options?: SearchProviderOptions): Promise<SearchProviderCandidate[]> {
    if (!this.isAvailable()) return [];

    const limit = Math.max(1, Math.min(options?.maxResults || 5, 20));
    const timeoutMs = options?.timeoutMs || 8000;
    const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
      query
    )}&count=${limit}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey!,
          'User-Agent': options?.userAgent || 'SeekrBot/1.0',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[BraveSearchProvider] HTTP error: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as any;
      const webResults = data.web?.results;
      if (!Array.isArray(webResults)) return [];

      const candidates: SearchProviderCandidate[] = [];
      webResults.slice(0, limit).forEach((item: any, idx: number) => {
        if (!item.url) return;
        let domain: string | undefined;
        try {
          domain = new URL(item.url).hostname.replace(/^www\./, '');
        } catch {}

        candidates.push({
          url: item.url,
          title: item.title || domain || 'Web Result',
          snippet: item.description || undefined,
          provider: this.name,
          rank: idx + 1,
          domain,
          publishedDate: item.page_age,
          relevanceScore: Math.max(0.1, 1 - idx * 0.08),
        });
      });

      return candidates;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[BraveSearchProvider] Request timed out after ${timeoutMs}ms`);
      } else {
        console.warn('[BraveSearchProvider] Request failed:', err.message || err);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
