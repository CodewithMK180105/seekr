import { SearchProvider, SearchProviderCandidate, SearchProviderOptions } from './provider.interface.js';

/**
 * Normalizes user queries by stripping conversational filler while preserving
 * technical keywords, multi-word entities, and acronyms.
 */
export function extractCoreQueryTerms(query: string): { original: string; cleaned: string; entityCandidate: string } {
  const original = query.trim();
  if (!original) return { original: '', cleaned: '', entityCandidate: '' };

  let cleaned = original
    .replace(/^(please\s+)?(can\s+you\s+)?(tell\s+me(\s+everything|\s+all|\s+more)?\s+(about|on)?|give\s+me(\s+the)?\s+(details|information|info)\s+(about|on|for)?|show\s+me(\s+information|\s+info)?\s+(about|on)?|provide\s+(details|information|info)\s+(about|on|for)?|explain(\s+to\s+me)?\s+(about|how)?|what\s+(is|are|was|were)|who\s+(is|was|were)|where\s+(is|was|were)|why\s+(is|was|are|does|do)|how\s+(does|do|can|to))\s+/i, '')
    .replace(/[?!.]+$/, '')
    .trim();

  // If cleaning reduced query to nothing, fallback to original
  if (!cleaned) {
    cleaned = original;
  }

  // Potential single entity or place (first 1-3 capitalized or primary nouns)
  const entityCandidate = cleaned.replace(/^(the|a|an)\s+/i, '').trim();

  return { original, cleaned, entityCandidate };
}

export class WikipediaDiscoveryProvider implements SearchProvider {
  readonly name = 'wikipedia';
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
    const { original, cleaned, entityCandidate } = extractCoreQueryTerms(raw);

    const candidates: SearchProviderCandidate[] = [];
    const seenUrls = new Set<string>();

    const addCandidate = (item: SearchProviderCandidate) => {
      try {
        const u = new URL(item.url);
        const norm = `${u.origin}${u.pathname}`;
        if (seenUrls.has(norm)) return;
        seenUrls.add(norm);
        candidates.push(item);
      } catch {}
    };

    // 1. Check Wikimedia REST API summary for direct entity matches (e.g., "Paris", "Virat Kohli")
    const entityTerms = Array.from(new Set([entityCandidate, cleaned])).filter(
      (t) => t && t.length >= 2 && !t.includes('/')
    );

    for (const term of entityTerms) {
      if (candidates.length >= limit) break;
      const formattedTitle = encodeURIComponent(term.replace(/\s+/g, '_'));
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${formattedTitle}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 3000));

      try {
        const res = await fetch(summaryUrl, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.type !== 'disambiguation' && data.title && data.extract) {
            const pageUrl =
              data.content_urls?.desktop?.page ||
              `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/\s+/g, '_'))}`;

            addCandidate({
              url: pageUrl,
              title: `${data.title} - Wikipedia`,
              snippet: data.extract,
              provider: this.name,
              rank: 1,
              domain: 'en.wikipedia.org',
              relevanceScore: 0.95,
            });
          }
        }
      } catch {
        // Ignore single-term summary error
      } finally {
        clearTimeout(timer);
      }
    }

    if (candidates.length >= limit) {
      return candidates.slice(0, limit);
    }

    // 2. Full-Text Wikimedia Search (action=query&list=search)
    const searchTerms = [cleaned];
    if (cleaned.toLowerCase() !== original.toLowerCase()) {
      searchTerms.push(original);
    }

    for (const term of searchTerms) {
      if (candidates.length >= limit) break;
      const endpoint = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term
      )}&utf8=&format=json`;

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

        if (res.ok) {
          const data = (await res.json()) as any;
          const items = data.query?.search;
          if (Array.isArray(items)) {
            for (let i = 0; i < items.length && candidates.length < limit; i++) {
              const item = items[i];
              if (!item.title || item.title.toLowerCase().includes('(disambiguation)')) continue;
              const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
                item.title.replace(/\s+/g, '_')
              )}`;
              const cleanSnippet = item.snippet
                ? item.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"')
                : undefined;

              addCandidate({
                url: pageUrl,
                title: `${item.title} - Wikipedia`,
                snippet: cleanSnippet,
                provider: this.name,
                rank: candidates.length + 1,
                domain: 'en.wikipedia.org',
                relevanceScore: Math.max(0.3, 0.9 - i * 0.1),
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('[WikipediaDiscoveryProvider] Search error:', err.message || err);
      } finally {
        clearTimeout(timer);
      }
    }

    return candidates.slice(0, limit);
  }
}
