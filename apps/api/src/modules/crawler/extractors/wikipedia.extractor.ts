import { ContentExtractor, ExtractedContent } from './extractor.interface.js';

export class WikipediaExtractor implements ContentExtractor {
  canExtract(url: string, _html: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.includes('wikipedia.org') || hostname.includes('wikimedia.org');
    } catch {
      return false;
    }
  }

  extract(html: string, url: string): ExtractedContent {
    // 1. Extract canonical title and URL
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
    const h1Match = html.match(/<h1[^>]*id=["']firstHeading["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    let rawTitle =
      ogTitleMatch?.[1] ||
      (h1Match ? h1Match[1].replace(/<[^>]+>/g, '') : '') ||
      'Wikipedia Article';

    const title = rawTitle.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : url;

    // 2. Slice primary article body (mw-parser-output until footer / catlinks)
    let body = html;
    const startIdx = html.indexOf('class="mw-parser-output"');
    if (startIdx !== -1) {
      const tagEnd = html.indexOf('>', startIdx);
      const fromStart = tagEnd !== -1 ? html.slice(tagEnd + 1) : html.slice(startIdx);
      const endMarkers = [
        'class="printfooter"',
        'id="catlinks"',
        '<!-- \nNewPP limit report',
        '<!-- NewPP limit report',
        'id="mw-data-after-content"',
      ];
      let endIdx = -1;
      for (const m of endMarkers) {
        const idx = fromStart.indexOf(m);
        if (idx !== -1 && (endIdx === -1 || idx < endIdx)) {
          endIdx = idx;
        }
      }
      body = endIdx !== -1 ? fromStart.slice(0, endIdx) : fromStart;
    }

    // 3. Iteratively strip scripts, styles, infoboxes, navboxes, and template remnants
    let cleaned = body;

    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    // Strip nested infoboxes and sidebars
    for (let pass = 0; pass < 5; pass++) {
      cleaned = cleaned.replace(
        /<table\b[^>]*class=["'][^"']*(?:infobox|sidebar|navbox|vertical-navbox)[^"']*["'][^>]*>(?:(?!<table)[\s\S])*?<\/table>/gi,
        ' '
      );
    }
    cleaned = cleaned.replace(
      /<table\b[^>]*class=["'][^"']*(?:infobox|sidebar|navbox)[^"']*["'][\s\S]*?<\/table>/gi,
      ' '
    );

    // Strip wikitext JSON remnants: {"wt":...}
    cleaned = cleaned.replace(/\{"(?:wt|parts|type|params|title|name)":[\s\S]*?\}/g, ' ');

    // Strip references, edit sections, hatnotes, disambiguation, thumbnails
    cleaned = cleaned
      .replace(/<div\b[^>]*class=["'][^"']*(?:navbox|catlinks|hatnote|disambig|metadata|reflist|mw-references-wrap|printfooter|sidebar|shortdescription)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ')
      .replace(/<sup\b[^>]*class=["'][^"']*reference[^"']*["'][^>]*>[\s\S]*?<\/sup>/gi, ' ')
      .replace(/<ol\b[^>]*class=["'][^"']*references[^"']*["'][^>]*>[\s\S]*?<\/ol>/gi, ' ')
      .replace(/<span\b[^>]*class=["'][^"']*mw-editsection[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<div\b[^>]*class=["'][^"']*(?:thumb|tright|tleft|thumbinner)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ')
      .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, ' ')
      .replace(/<span\b[^>]*id=["']coordinates["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n$1\n\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');

    // 4. Decode HTML entities and clean wikitext remnants
    const content = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&minus;/g, '-')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/\[\s*\d+\s*\]/g, '') // remove citation marks [1]
      .replace(/\{\{[^}]+\}\}/g, ' ')
      .replace(/\[\[(?:Category|File|Image):[^\]]+\]\]/gi, ' ')
      .replace(/Coordinates\s*:\s*[-0-9°′″NSEW\s\./;]+/gi, ' ')
      .replace(/From Wikipedia,\s*the free encyclopedia/gi, ' ')
      .replace(/\r\n|\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      title,
      content,
      canonicalUrl,
      language: 'en',
    };
  }
}
