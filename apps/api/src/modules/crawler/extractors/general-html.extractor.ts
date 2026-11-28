import { ContentExtractor, ExtractedContent } from './extractor.interface.js';

export class GeneralHtmlExtractor implements ContentExtractor {
  canExtract(_url: string, _html: string): boolean {
    return true; // Default fallback for all HTML pages
  }

  extract(html: string, url: string): ExtractedContent {
    // 1. Extract canonical URL & Title
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);

    let rawTitle =
      ogTitleMatch?.[1] ||
      (titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : '') ||
      (h1Match ? h1Match[1].replace(/<[^>]+>/g, '') : '') ||
      'Web Document';

    const title = rawTitle.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : url;
    const description = descMatch ? descMatch[1].trim() : undefined;

    // 2. Strip layout boilerplate, scripts, styles, forms, cookies, navigation
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<div\b[^>]*class=["'][^"']*(?:cookie|banner|advertisement|modal|popup)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ');

    // 3. Extract main content container if available
    const mainMatch =
      cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
      cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
      cleaned.match(/<div\b[^>]*(?:id|class)=["'][^"']*(?:content|article|docs|documentation|markdown-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    if (mainMatch) {
      cleaned = mainMatch[1];
    }

    // 4. Structure preservation
    cleaned = cleaned
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n$1\n\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');

    // 5. Decode entities & clean whitespace
    const content = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r\n|\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      title,
      content,
      canonicalUrl,
      description,
    };
  }
}
