export * from './extractor.interface.js';
export * from './wikipedia.extractor.js';
export * from './general-html.extractor.js';

import { ContentExtractor, ExtractedContent } from './extractor.interface.js';
import { WikipediaExtractor } from './wikipedia.extractor.js';
import { GeneralHtmlExtractor } from './general-html.extractor.js';

const extractors: ContentExtractor[] = [
  new WikipediaExtractor(),
  new GeneralHtmlExtractor(),
];

export function extractContent(html: string, url: string): ExtractedContent {
  for (const ext of extractors) {
    if (ext.canExtract(url, html)) {
      return ext.extract(html, url);
    }
  }
  return new GeneralHtmlExtractor().extract(html, url);
}
