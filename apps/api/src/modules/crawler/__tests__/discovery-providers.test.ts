import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectUrlProvider } from '../providers/direct-url.provider.js';
import { WikipediaDiscoveryProvider } from '../providers/wikipedia-discovery.provider.js';
import { DuckDuckGoDiscoveryProvider } from '../providers/duckduckgo-discovery.provider.js';
import { SearchProviderRegistry } from '../providers/index.js';

describe('Discovery Providers Architecture', () => {
  it('DirectUrlProvider identifies raw HTTP and HTTPS URLs', async () => {
    const provider = new DirectUrlProvider();
    const result = await provider.search('https://docs.docker.com/engine/network');
    expect(result.length).toBe(1);
    expect(result[0].domain).toBe('docs.docker.com');
    expect(result[0].provider).toBe('direct');
  });

  it('DirectUrlProvider identifies bare domains', async () => {
    const provider = new DirectUrlProvider();
    const result = await provider.search('redis.io');
    expect(result.length).toBe(1);
    expect(result[0].url).toBe('https://redis.io');
  });

  it('DirectUrlProvider returns empty for conversational queries', async () => {
    const provider = new DirectUrlProvider();
    const result = await provider.search('Give me the details about Paris');
    expect(result.length).toBe(0);
  });

  it('SearchProviderRegistry lists available and external search engines', () => {
    const registry = new SearchProviderRegistry();
    const available = registry.getAvailableProviders();
    expect(available.length).toBeGreaterThanOrEqual(3);

    // Direct, Wikipedia, and DuckDuckGo are built-in and always available
    const names = available.map((p) => p.name);
    expect(names).toContain('direct');
    expect(names).toContain('wikipedia');
    expect(names).toContain('duckduckgo');
  });

  it('WikipediaDiscoveryProvider strips conversational prefixes and queries Wikimedia summary', async () => {
    const provider = new WikipediaDiscoveryProvider();

    // Mock fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/rest_v1/page/summary/Paris')) {
        return {
          ok: true,
          json: async () => ({
            type: 'standard',
            title: 'Paris',
            extract: 'Paris is the capital of France.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Paris' } },
          }),
        };
      }
      return { ok: false };
    }) as any;

    try {
      const candidates = await provider.search('Give me the details about Paris');
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0].title).toBe('Paris - Wikipedia');
      expect(candidates[0].url).toBe('https://en.wikipedia.org/wiki/Paris');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('DuckDuckGoDiscoveryProvider parses instant answers and related topics', async () => {
    const provider = new DuckDuckGoDiscoveryProvider();
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Heading: 'Python (programming language)',
        AbstractURL: 'https://en.wikipedia.org/wiki/Python_(programming_language)',
        AbstractText: 'Python is a high-level programming language.',
        RelatedTopics: [],
      }),
    }) as any;

    try {
      const candidates = await provider.search('Python programming');
      expect(candidates.length).toBe(1);
      expect(candidates[0].title).toBe('Python (programming language)');
      expect(candidates[0].provider).toBe('duckduckgo');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
