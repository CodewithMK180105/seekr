import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';

export class SearxngSearchProvider implements SearchProvider {
  readonly name = 'searxng';
  readonly isExternalSearchEngine = true;

  private baseUrl?: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.SEARXNG_URL;
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl);
  }

  async search(query: string, options?: SearchProviderOptions): Promise<SearchProviderCandidate[]> {
    if (!this.isAvailable()) return [];

    const limit = Math.max(1, Math.min(options?.maxResults || 5, 20));
    const timeoutMs = options?.timeoutMs || 8000;
    const cleanBase = this.baseUrl!.replace(/\/+$/, '');
    const endpoint = `${cleanBase}/search?q=${encodeURIComponent(query)}&format=json`;

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
        console.warn(`[SearxngSearchProvider] HTTP error: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as any;
      const results = data.results;
      if (!Array.isArray(results)) return [];

      const candidates: SearchProviderCandidate[] = [];
      results.slice(0, limit).forEach((item: any, idx: number) => {
        if (!item.url) return;
        let domain: string | undefined;
        try {
          domain = new URL(item.url).hostname.replace(/^www\./, '');
        } catch {}

        candidates.push({
          url: item.url,
          title: item.title || domain || 'Web Result',
          snippet: item.content || undefined,
          provider: this.name,
          rank: idx + 1,
          domain,
          publishedDate: item.publishedDate,
          relevanceScore: Math.max(0.1, 1 - idx * 0.08),
        });
      });

      return candidates;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[SearxngSearchProvider] Request timed out after ${timeoutMs}ms`);
      } else {
        console.warn('[SearxngSearchProvider] Request failed:', err.message || err);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
