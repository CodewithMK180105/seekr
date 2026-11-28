export interface ExtractedContent {
  title: string;
  content: string;
  canonicalUrl?: string;
  language?: string;
  description?: string;
}

export interface ContentExtractor {
  canExtract(url: string, html: string): boolean;
  extract(html: string, url: string): ExtractedContent;
}
