export * from './provider.interface.js';
export * from './direct-url.provider.js';
export * from './google-search.provider.js';
export * from './brave-search.provider.js';
export * from './serpapi-search.provider.js';
export * from './searxng-search.provider.js';
export * from './wikipedia-discovery.provider.js';
export * from './duckduckgo-discovery.provider.js';

import { SearchProvider } from './provider.interface.js';
import { DirectUrlProvider } from './direct-url.provider.js';
import { GoogleSearchProvider } from './google-search.provider.js';
import { BraveSearchProvider } from './brave-search.provider.js';
import { SerpApiSearchProvider } from './serpapi-search.provider.js';
import { SearxngSearchProvider } from './searxng-search.provider.js';
import { WikipediaDiscoveryProvider } from './wikipedia-discovery.provider.js';
import { DuckDuckGoDiscoveryProvider } from './duckduckgo-discovery.provider.js';

export class SearchProviderRegistry {
  private providers: SearchProvider[];

  constructor(customProviders?: SearchProvider[]) {
    this.providers = customProviders || [
      new DirectUrlProvider(),
      new GoogleSearchProvider(),
      new BraveSearchProvider(),
      new SerpApiSearchProvider(),
      new SearxngSearchProvider(),
      new WikipediaDiscoveryProvider(),
      new DuckDuckGoDiscoveryProvider(),
    ];
  }

  getAvailableProviders(): SearchProvider[] {
    return this.providers.filter((p) => p.isAvailable());
  }

  getExternalSearchProviders(): SearchProvider[] {
    return this.providers.filter((p) => p.isExternalSearchEngine && p.isAvailable());
  }

  hasActiveExternalSearchEngine(): boolean {
    return this.getExternalSearchProviders().length > 0;
  }
}
