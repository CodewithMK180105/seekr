import * as cheerio from 'cheerio';

export interface ExtractedContent {
  title: string;
  content: string;
  links: string[];
  canonicalUrl?: string | null;
}

const STATIC_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'mp4', 'webm',
  'mp3', 'wav', 'pdf', 'zip', 'tar', 'gz', 'tgz', 'exe', 'dmg', 'css', 'js',
]);

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'ref', 'source', 'v', 'trk',
]);

/**
 * Normalizes a URL by stripping tracking parameters, hash fragments, and trailing slashes.
 */
function cleanUrl(targetUrl: URL): string {
  targetUrl.hash = '';
  // Remove known marketing and tracking parameters
  const keysToDelete: string[] = [];
  targetUrl.searchParams.forEach((_, key) => {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
      keysToDelete.push(key);
    }
  });
  for (const k of keysToDelete) {
    targetUrl.searchParams.delete(k);
  }

  let cleanStr = targetUrl.toString();
  // Strip trailing slash unless it's the root path (e.g. http://domain.com/)
  if (targetUrl.pathname.length > 1 && cleanStr.endsWith('/')) {
    cleanStr = cleanStr.slice(0, -1);
  }
  return cleanStr;
}

export function extractContent(html: string, currentUrl: string): ExtractedContent {
  const $ = cheerio.load(html);

  // 1. Extract Title
  let title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text() ||
    $('h1').first().text() ||
    'Untitled Document';

  title = title.trim().replace(/[\r\n\t]+/g, ' ');

  let baseUrl: URL;
  try {
    baseUrl = new URL(currentUrl);
  } catch {
    baseUrl = new URL('http://localhost');
  }

  // 2. Extract Canonical URL if specified
  let canonicalUrl: string | null = null;
  const rawCanonical = $('link[rel="canonical"]').attr('href');
  if (rawCanonical) {
    try {
      const resolvedCanonical = new URL(rawCanonical, baseUrl);
      if (
        (resolvedCanonical.protocol === 'http:' || resolvedCanonical.protocol === 'https:') &&
        resolvedCanonical.hostname === baseUrl.hostname
      ) {
        canonicalUrl = cleanUrl(resolvedCanonical);
      }
    } catch {}
  }

  // 3. Discover internal hyperlinks before removing navigation elements
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    if (!rawHref) return;

    // Skip javascript:, mailto:, tel: protocols
    if (/^(javascript|mailto|tel|data):/i.test(rawHref.trim())) return;

    try {
      const resolved = new URL(rawHref, baseUrl);
      // Only keep HTTP/HTTPS links on the same host
      if (
        (resolved.protocol === 'http:' || resolved.protocol === 'https:') &&
        resolved.hostname === baseUrl.hostname
      ) {
        // Skip static file downloads
        const pathname = resolved.pathname;
        const ext = pathname.split('.').pop()?.toLowerCase();
        if (ext && STATIC_EXTENSIONS.has(ext)) {
          return;
        }

        const finalUrl = cleanUrl(resolved);
        if (!links.includes(finalUrl) && finalUrl !== cleanUrl(baseUrl)) {
          links.push(finalUrl);
        }
      }
    } catch {
      // ignore invalid URLs
    }
  });

  // 4. Remove non-content, noise, navigation, and advertising elements
  $(
    'script, style, noscript, iframe, svg, canvas, nav, footer, header, aside, ' +
    '.nav, .menu, .sidebar, .ad, .advertisement, .cookie-banner, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]'
  ).remove();

  // 5. Preserve formatting for code blocks and headings
  // Wrap code blocks to preserve code structure
  $('pre').each((_, el) => {
    const code = $(el).text();
    if (code.trim().length > 0) {
      $(el).text(`\n\n\`\`\`\n${code}\n\`\`\`\n\n`);
    }
  });

  // Demarcate headings so downstream text chunking retains heading context
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const headingText = $(el).text().trim();
    if (headingText.length > 0) {
      $(el).text(`\n\n## ${headingText}\n\n`);
    }
  });

  // Format table rows with pipe separators for tabular technical data
  $('tr').each((_, el) => {
    const cells: string[] = [];
    $(el).find('th, td').each((_, c) => {
      cells.push($(c).text().trim());
    });
    if (cells.length > 0) {
      $(el).text(cells.join(' | ') + '\n');
    }
  });

  // Add line breaks after remaining block elements to preserve natural paragraph separation
  $('p, li, dt, dd, blockquote').each((_, el) => {
    $(el).append('\n\n');
  });

  // 6. Extract structured text from main article elements if present and non-empty, else fallback to body
  const mainCandidate = $('main, article, [role="main"]').first();
  const target =
    mainCandidate.length && mainCandidate.text().trim().length > 50
      ? mainCandidate
      : $('body');

  const rawText = target.text();

  return {
    title,
    content: rawText,
    links,
    canonicalUrl,
  };
}
