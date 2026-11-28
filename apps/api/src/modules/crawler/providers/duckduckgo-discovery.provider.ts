import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';
import { extractCoreQueryTerms } from './wikipedia-discovery.provider.js';

export class DuckDuckGoDiscoveryProvider implements SearchProvider {
  readonly name = 'duckduckgo';
  readonly isExternalSearchEngine = false;

  private userAgent: string;

  constructor(userAgent = 'SeekrBot/1.0 (+https://github.com/seekr-search)') {
    this.userAgent = userAgent;
  }

  isAvailable(): boolean {
    return true;
  }

  async search(query: string, options?: SearchProviderOptions): Promise<SearchProviderCandidate[]> {
    const raw = query.trim();
    if (!raw) return [];

    const limit = Math.max(1, Math.min(options?.maxResults || 3, 5));
    const timeoutMs = options?.timeoutMs || 6000;
    const { cleaned } = extractCoreQueryTerms(raw);

    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      cleaned
    )}&format=json&no_redirect=1&no_html=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) return [];

      const data = (await res.json()) as any;
      const candidates: SearchProviderCandidate[] = [];

      if (data && data.AbstractURL && typeof data.AbstractURL === 'string') {
        let domain: string | undefined;
        try {
          domain = new URL(data.AbstractURL).hostname.replace(/^www\./, '');
        } catch {}

        candidates.push({
          url: data.AbstractURL,
          title: data.Heading || cleaned,
          snippet: data.AbstractText || undefined,
          provider: this.name,
          rank: 1,
          domain,
          relevanceScore: 0.85,
        });
      }

      if (data && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (candidates.length >= limit) break;
          if (topic.FirstURL && typeof topic.FirstURL === 'string') {
            let domain: string | undefined;
            try {
              domain = new URL(topic.FirstURL).hostname.replace(/^www\./, '');
            } catch {}

            const rawText = topic.Text || '';
            const title = rawText.includes(' - ') ? rawText.split(' - ')[0] : cleaned;

            candidates.push({
              url: topic.FirstURL,
              title,
              snippet: rawText || undefined,
              provider: this.name,
              rank: candidates.length + 1,
              domain,
              relevanceScore: Math.max(0.3, 0.8 - candidates.length * 0.1),
            });
          }
        }
      }

      return candidates.slice(0, limit);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[DuckDuckGoDiscoveryProvider] Error:', err.message || err);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
