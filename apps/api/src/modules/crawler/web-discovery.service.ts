import {
  SearchProviderRegistry,
  SearchProviderCandidate,
} from './providers/index.js';
import { candidateValidatorService } from './candidate-validator.service.js';
import { normalizeUrl } from './url-normalizer.js';

export interface DiscoveredUrl {
  url: string;
  title: string;
  snippet?: string;
  source: string;
  relevanceScore: number;
  domain?: string;
}

export class WebDiscoveryService {
  private registry: SearchProviderRegistry;

  constructor(registry: SearchProviderRegistry = new SearchProviderRegistry()) {
    this.registry = registry;
  }

  /**
   * Discovers authoritative, relevant web URLs for arbitrary user queries.
   * Uses prioritized multi-provider discovery:
   * 1. Direct URL check
   * 2. External Web Search APIs (Google Custom Search, Brave, SerpApi, SearXNG) if configured
   * 3. Wikipedia Entity & Full-Text Search (with NLP conversational entity extraction)
   * 4. DuckDuckGo Instant Discovery
   *
   * Every candidate is deduplicated and rigorously validated for relevance to prevent
   * index pollution.
   */
  async discoverUrls(query: string, maxUrls = 3): Promise<DiscoveredUrl[]> {
    const rawQuery = query.trim();
    if (!rawQuery) return [];

    const discovered: DiscoveredUrl[] = [];
    const seenUrls = new Set<string>();

    const addCandidate = (cand: SearchProviderCandidate) => {
      const normalized = normalizeUrl(cand.url);
      if (!normalized) return;
      if (seenUrls.has(normalized)) return;

      // Validate candidate relevance before admitting into queue
      const validation = candidateValidatorService.validateCandidate(cand, rawQuery);
      if (!validation.valid) {
        console.log(
          `[WebDiscovery] Rejected candidate "${cand.title}" (${cand.url}) from provider ${cand.provider}: ${validation.reason}`
        );
        return;
      }

      seenUrls.add(normalized);
      discovered.push({
        url: normalized,
        title: cand.title,
        snippet: cand.snippet,
        source: cand.provider,
        relevanceScore: validation.score,
        domain: cand.domain,
      });
    };

    const providers = this.registry.getAvailableProviders();

    for (const provider of providers) {
      if (discovered.length >= maxUrls) break;

      try {
        const candidates = await provider.search(rawQuery, {
          maxResults: maxUrls * 2,
          timeoutMs: 6000,
        });

        for (const cand of candidates) {
          addCandidate(cand);
          if (discovered.length >= maxUrls) break;
        }
      } catch (err: any) {
        console.warn(`[WebDiscovery] Provider "${provider.name}" failed:`, err?.message || err);
        // Continue to other providers gracefully
      }
    }

    // Sort by relevance score descending
    discovered.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return discovered.slice(0, maxUrls);
  }
}

export const webDiscoveryService = new WebDiscoveryService();
