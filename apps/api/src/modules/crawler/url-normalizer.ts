const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'ref_src',
  'ref_url',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'zanpid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
]);

/**
 * Robust URL normalizer for web crawling, deduplication, and search indexing.
 */
export function normalizeUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // 1. Lowercase hostname and remove default ports
    let hostname = parsed.hostname.toLowerCase();
    // Convert mobile Wikipedia to desktop canonical
    if (hostname === 'en.m.wikipedia.org') {
      hostname = 'en.wikipedia.org';
    }

    // 2. Strip tracking and analytics query parameters
    const searchParams = new URLSearchParams(parsed.search);
    for (const param of Array.from(searchParams.keys())) {
      if (TRACKING_PARAMS.has(param.toLowerCase()) || param.toLowerCase().startsWith('utm_')) {
        searchParams.delete(param);
      }
    }

    // Sort parameters for deterministic caching and deduplication
    searchParams.sort();

    // 3. Normalize pathname (strip all trailing slashes)
    let pathname = parsed.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
    const searchString = searchParams.toString();
    const queryPart = searchString ? `?${searchString}` : '';

    return `${parsed.protocol}//${hostname}${pathname}${queryPart}`;
  } catch {
    return null;
  }
}

/**
 * Extracts a normalized hostname/domain for display and diversity controls.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'web';
  }
}
