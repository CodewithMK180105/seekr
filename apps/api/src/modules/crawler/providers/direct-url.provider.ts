import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';
import { normalizeUrl } from '../url-normalizer.js';

export class DirectUrlProvider implements SearchProvider {
  readonly name = 'direct';
  readonly isExternalSearchEngine = false;

  isAvailable(): boolean {
    return true;
  }

  async search(query: string, _options?: SearchProviderOptions): Promise<SearchProviderCandidate[]> {
    const raw = query.trim();
    if (!raw) return [];

    let targetUrl: string | null = null;

    if (/^https?:\/\/[^\s]+$/i.test(raw)) {
      targetUrl = raw;
    } else if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/i.test(raw)) {
      targetUrl = `https://${raw}`;
    }

    if (!targetUrl) return [];

    const normalized = normalizeUrl(targetUrl);
    if (!normalized) return [];

    try {
      const parsed = new URL(normalized);

      return [
        {
          url: normalized,
          title: parsed.hostname,
          snippet: `Direct URL target: ${normalized}`,
          provider: this.name,
          rank: 1,
          domain: parsed.hostname.replace(/^www\./, ''),
          relevanceScore: 1.0,
        },
      ];
    } catch {
      return [];
    }
  }
}
