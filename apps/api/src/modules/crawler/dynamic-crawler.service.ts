import { createHash } from 'node:crypto';
import {
  prisma,
  validateSafeUrl,
  chunkDocument,
  getEmbeddingProvider,
} from '@seekr/shared';
import { SearchResultItem } from '@seekr/types';
import { webDiscoveryService } from './web-discovery.service.js';
import { VectorRetrieverService } from '../search/services/vector-retriever.service.js';
import { extractContent } from './extractors/index.js';
import { normalizeUrl, extractDomain } from './url-normalizer.js';
import { queryUnderstandingService } from '../search/services/query-understanding.service.js';

export interface DynamicCrawlOptions {
  maxPages?: number;
  timeoutMs?: number;
  maxChunksPerDoc?: number;
}

export class DynamicCrawlerService {
  private userAgent = 'SeekrBot/1.0 (+https://github.com/seekr-search)';

  /**
   * Dynamically crawls and indexes web content for a query when local results are empty.
   * Discovers candidate URLs, validates eligibility, indexes eligible content,
   * and returns freshly indexed, document-deduplicated results.
   */
  async crawlForQuery(query: string, options?: DynamicCrawlOptions): Promise<SearchResultItem[]> {
    const rawQuery = query.trim();
    if (!rawQuery) return [];

    const maxPages = options?.maxPages || 3;
    console.log(`[DynamicCrawler] Discovering and crawling web content for: "${rawQuery}"`);

    // 1. Discover target URLs with multi-tier providers and candidate relevance validation
    const discovered = await webDiscoveryService.discoverUrls(rawQuery, maxPages);
    if (discovered.length === 0) {
      console.log(`[DynamicCrawler] No qualifying web URLs discovered for: "${rawQuery}"`);
      return [];
    }

    console.log(
      `[DynamicCrawler] Discovered ${discovered.length} qualified URLs for query "${rawQuery}":`,
      discovered.map((d) => `${d.title} (${d.url})`)
    );

    // 2. Crawl and index each discovered URL with controlled concurrency
    let indexedAny = false;
    for (let i = 0; i < discovered.length; i++) {
      const target = discovered[i];
      try {
        const docId = await this.crawlAndIndexUrl(target.url, rawQuery, options);
        if (docId) {
          indexedAny = true;
        }
      } catch (err: any) {
        console.warn(`[DynamicCrawler] Failed crawling ${target.url}:`, err?.message || err);
      }
    }

    if (!indexedAny) {
      console.log(`[DynamicCrawler] No documents satisfied ingestion eligibility for "${rawQuery}"`);
      return [];
    }

    // 3. Search and calibrate freshly indexed documents using pgvector semantic ranking
    const vectorRetriever = new VectorRetrieverService();
    const rankedCandidates = await vectorRetriever.search(rawQuery, 20);

    // 4. Deduplicate at Document Level (so 1 document does not dominate results)
    const seenDocIds = new Set<string>();
    const deduplicated: SearchResultItem[] = [];

    for (const r of rankedCandidates) {
      if (seenDocIds.has(r.documentId)) continue;
      seenDocIds.add(r.documentId);

      deduplicated.push({
        chunkId: r.chunkId,
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        rank: deduplicated.length + 1,
        sourceType: r.sourceType,
        keywordRank: null,
        vectorRank: r.rank,
        matchedBy: { keyword: false, vector: true },
      });

      if (deduplicated.length >= 10) break;
    }

    return deduplicated;
  }

  /**
   * Crawls a single URL, checks SSRF, extracts clean content using modular extractors,
   * validates ingestion eligibility, chunks, embeds with Gemini, and stores to PostgreSQL.
   * Returns the document ID if successfully indexed, or null if rejected.
   */
  async crawlAndIndexUrl(
    rawUrl: string,
    query?: string,
    options?: DynamicCrawlOptions
  ): Promise<string | null> {
    const normalizedTarget = normalizeUrl(rawUrl);
    if (!normalizedTarget) return null;

    // A. SSRF Guard
    const safeUrl = await validateSafeUrl(normalizedTarget);

    // B. Check if already indexed in database by URL
    const existingDoc = await prisma.document.findUnique({
      where: { url: safeUrl },
      select: { id: true },
    });

    if (existingDoc) {
      console.log(`[DynamicCrawler] Document already indexed: ${safeUrl}`);
      return existingDoc.id;
    }

    // C. Fetch web page
    const timeoutMs = options?.timeoutMs || 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let html: string;
    try {
      const res = await fetch(safeUrl, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[DynamicCrawler] HTTP ${res.status} for ${safeUrl}`);
        return null;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        console.log(`[DynamicCrawler] Skipping non-HTML content-type: ${contentType}`);
        return null;
      }

      html = await res.text();
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        console.warn(`[DynamicCrawler] Request timed out after ${timeoutMs}ms for ${safeUrl}`);
      } else {
        console.warn(`[DynamicCrawler] Network error for ${safeUrl}:`, fetchErr.message || fetchErr);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }

    // D. Extract Clean Text with Modular Extractor (Wikipedia or General HTML)
    const extracted = extractContent(html, safeUrl);
    const title = extracted.title.trim();
    const content = extracted.content.trim();
    const canonical = extracted.canonicalUrl ? normalizeUrl(extracted.canonicalUrl) || safeUrl : safeUrl;

    // E. Ingestion Eligibility Rules
    // Rule 1: Minimum content length
    if (content.length < 200) {
      console.log(`[DynamicCrawler] Content rejected (too short: ${content.length} chars): ${safeUrl}`);
      return null;
    }

    // Rule 2: Rejection of error pages, CAPTCHAs, or access denied pages
    const lowerTitle = title.toLowerCase();
    if (
      lowerTitle.includes('404 not found') ||
      lowerTitle.includes('page not found') ||
      lowerTitle.includes('access denied') ||
      lowerTitle.includes('attention required') ||
      lowerTitle.includes('security check')
    ) {
      console.log(`[DynamicCrawler] Content rejected (error / block page: "${title}"): ${safeUrl}`);
      return null;
    }

    // Rule 3: Content relevance validation (if query provided)
    if (query) {
      const parsed = queryUnderstandingService.parseQuery(query);
      const targetKeywords = parsed.coreKeywords;
      const entity = parsed.entityCandidate?.toLowerCase();

      const lowerContent = content.toLowerCase();
      const lowerTitleText = title.toLowerCase();

      // Check entity match first
      const hasEntityMatch = Boolean(entity && entity.length >= 2 && (lowerTitleText.includes(entity) || lowerContent.includes(entity)));

      // Check keyword coverage ratio (at least 35% of significant query keywords present in title or content)
      let matchedCount = 0;
      for (const kw of targetKeywords) {
        if (lowerTitleText.includes(kw) || lowerContent.includes(kw)) {
          matchedCount++;
        }
      }
      const keywordRatio = targetKeywords.length > 0 ? matchedCount / targetKeywords.length : 1.0;

      if (!hasEntityMatch && keywordRatio < 0.35 && targetKeywords.length > 0) {
        console.log(
          `[DynamicCrawler] Content rejected (failed query relevance check: only ${matchedCount}/${targetKeywords.length} terms matched for "${query}"): ${safeUrl}`
        );
        return null;
      }
    }

    // F. Content Hash Deduplication
    const contentHash = createHash('sha256').update(content).digest('hex');
    const existingByHash = await prisma.document.findFirst({
      where: { contentHash },
      select: { id: true },
    });

    if (existingByHash) {
      console.log(`[DynamicCrawler] Document with identical content already indexed: ${safeUrl}`);
      return existingByHash.id;
    }

    // G. Ensure Source in PostgreSQL
    const domain = extractDomain(canonical);
    let source = await prisma.source.findFirst({
      where: { baseUrl: new URL(canonical).origin },
    });

    if (!source) {
      source = await prisma.source.create({
        data: {
          name: domain,
          baseUrl: new URL(canonical).origin,
          sourceType: 'WEBSITE',
          status: 'ACTIVE',
        },
      });
    }

    // H. Persist Document in PostgreSQL
    const doc = await prisma.document.upsert({
      where: { url: canonical },
      create: {
        sourceId: source.id,
        url: canonical,
        title: title || `${domain} Article`,
        content,
        contentHash,
        crawledAt: new Date(),
      },
      update: {
        title: title || `${domain} Article`,
        content,
        contentHash,
        updatedAt: new Date(),
        crawledAt: new Date(),
      },
    });

    // I. Chunk and Embed Document
    const chunks = chunkDocument(content, { maxTokens: 400, overlapTokens: 40 });
    if (chunks.length === 0) return doc.id;

    const maxChunks = options?.maxChunksPerDoc || 15;
    const chunksToIndex = chunks.slice(0, maxChunks);

    const provider = getEmbeddingProvider();
    const texts = chunksToIndex.map((c: { content: string }) => c.content);

    let embeddings: number[][];
    try {
      embeddings = await provider.embedBatch(texts);
    } catch (embedErr) {
      console.error('[DynamicCrawler] Batch embedding generation failed:', embedErr);
      return doc.id;
    }

    // J. Insert Chunks with pgvector embedding and Full-Text Search tsvector
    for (let i = 0; i < chunksToIndex.length; i++) {
      const chunk = chunksToIndex[i];
      const emb = embeddings[i];
      if (!emb || emb.length === 0) continue;

      const vectorString = `[${emb.join(',')}]`;
      const tokenCount = chunk.tokenCount || Math.ceil(chunk.content.length / 4);

      try {
        await prisma.$executeRaw`
          INSERT INTO document_chunks (
            id, document_id, chunk_index, content, embedding, search_vector, token_count, created_at
          ) VALUES (
            gen_random_uuid(), ${doc.id}::uuid, ${chunk.chunkIndex}, ${chunk.content}, ${vectorString}::vector, to_tsvector('english', ${chunk.content}), ${tokenCount}, NOW()
          );
        `;
      } catch (insertErr) {
        console.warn(`[DynamicCrawler] Failed inserting chunk ${i}:`, insertErr);
      }
    }

    console.log(
      `[DynamicCrawler] Successfully indexed ${chunksToIndex.length} clean chunks for ${canonical} ("${title}")`
    );

    return doc.id;
  }
}

export const dynamicCrawlerService = new DynamicCrawlerService();
