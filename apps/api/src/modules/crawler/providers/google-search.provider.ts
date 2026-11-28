import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';

export class GoogleSearchProvider implements SearchProvider {
  readonly name = 'google';
  readonly isExternalSearchEngine = true;

  private apiKey?: string;
  private cx?: string;

  constructor(apiKey?: string, cx?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_SEARCH_API_KEY;
    this.cx = cx || process.env.GOOGLE_SEARCH_CX;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.cx);
  }

  async search(query: string, options?: SearchProviderOptions): Promise<SearchProviderCandidate[]> {
    if (!this.isAvailable()) return [];

    const limit = Math.max(1, Math.min(options?.maxResults || 5, 10));
    const timeoutMs = options?.timeoutMs || 8000;
    const endpoint = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(
      this.apiKey!
    )}&cx=${encodeURIComponent(this.cx!)}&q=${encodeURIComponent(query)}&num=${limit}`;

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
        if (res.status === 429) {
          console.warn('[GoogleSearchProvider] Rate limited (HTTP 429)');
        } else {
          console.warn(`[GoogleSearchProvider] HTTP error: ${res.status} ${res.statusText}`);
        }
        return [];
      }

      const data = (await res.json()) as any;
      if (!data.items || !Array.isArray(data.items)) return [];

      const candidates: SearchProviderCandidate[] = [];
      data.items.slice(0, limit).forEach((item: any, idx: number) => {
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
          relevanceScore: Math.max(0.1, 1 - idx * 0.08),
        });
      });

      return candidates;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[GoogleSearchProvider] Request timed out after ${timeoutMs}ms`);
      } else {
        console.warn('[GoogleSearchProvider] Request failed:', err.message || err);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
