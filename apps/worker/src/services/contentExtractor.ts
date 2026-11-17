import * as cheerio from 'cheerio';

export interface ExtractedContent {
  title: string;
  content: string;
  links: string[];
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

  // 2. Discover internal hyperlinks before removing navigation elements
  const links: string[] = [];
  let baseUrl: URL;
  try {
    baseUrl = new URL(currentUrl);
  } catch {
    baseUrl = new URL('http://localhost');
  }

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    if (!rawHref) return;

    try {
      const resolved = new URL(rawHref, baseUrl);
      // Only keep HTTP/HTTPS links on the same host
      if (
        (resolved.protocol === 'http:' || resolved.protocol === 'https:') &&
        resolved.hostname === baseUrl.hostname
      ) {
        resolved.hash = ''; // strip anchor
        const finalUrl = resolved.toString();
        if (!links.includes(finalUrl) && finalUrl !== currentUrl) {
          links.push(finalUrl);
        }
      }
    } catch {
      // ignore invalid URLs
    }
  });

  // 3. Remove non-content, noise, navigation, and advertising elements
  $(
    'script, style, noscript, iframe, svg, canvas, nav, footer, header, aside, ' +
    '.nav, .menu, .sidebar, .ad, .advertisement, .cookie-banner, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]'
  ).remove();

  // Add line breaks after block elements to preserve natural paragraph separation
  $('p, h1, h2, h3, h4, h5, h6, li, dt, dd, tr, blockquote, pre').each((_, el) => {
    $(el).append('\n\n');
  });

  // 4. Extract structured text from main article elements if present and non-empty, else fallback to body
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
  };
}
