import { Job } from 'bullmq';
import axios from 'axios';
import {
  prisma,
  getIndexerQueue,
  crawlerJobsProcessedTotal,
  crawlerJobDurationSeconds,
} from '@seekr/shared';
import { CrawlJobData } from '@seekr/types';
import { validateSafeUrl } from '../services/ssrfGuard.js';
import { robotsService } from '../services/robotsService.js';
import { extractContent } from '../services/contentExtractor.js';
import { normalizeTextAndHash } from '../services/normalizer.js';

interface QueueItem {
  url: string;
  depth: number;
  priority: number;
}

const DOC_PATH_PATTERNS = [
  /\/docs(\/|$)/i,
  /\/documentation(\/|$)/i,
  /\/guide(s)?(\/|$)/i,
  /\/reference(\/|$)/i,
  /\/manual(s)?(\/|$)/i,
  /\/tutorial(s)?(\/|$)/i,
  /\/api(\/|$)/i,
  /\/concepts(\/|$)/i,
  /\/how-to(\/|$)/i,
  /\/learn(\/|$)/i,
  /\/overview(\/|$)/i,
  /\/topics(\/|$)/i,
];

const LOW_VALUE_PATTERNS = [
  /\/blog(\/|$)/i,
  /\/news(\/|$)/i,
  /\/press(\/|$)/i,
  /\/events(\/|$)/i,
  /\/webinars(\/|$)/i,
  /\/pricing(\/|$)/i,
  /\/careers(\/|$)/i,
  /\/jobs(\/|$)/i,
  /\/legal(\/|$)/i,
  /\/privacy(\/|$)/i,
  /\/terms(\/|$)/i,
  /\/cookie(\/|$)/i,
  /\/login(\/|$)/i,
  /\/signup(\/|$)/i,
  /\/cart(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/contact(\/|$)/i,
];

/**
 * Calculates a crawl priority score for candidate URLs to prioritize
 * technical documentation over marketing, blogs, and administrative pages.
 */
export function calculateUrlPriority(urlStr: string, rootBaseUrl: string): number {
  let score = 0;
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname;

    // 1. Documentation path bonus (+25)
    if (DOC_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      score += 25;
    }

    // 2. Base URL subpath alignment (+20)
    // If the crawl was started from a specific doc path, prioritize links in that subtree
    const rootPath = new URL(rootBaseUrl).pathname;
    if (rootPath !== '/' && path.startsWith(rootPath)) {
      score += 20;
    }

    // 3. Technical keywords in path (+10)
    if (
      /(persistence|snapshot|index|b-tree|queue|retry|network|bridge|deploy|pod|cluster|daemon|operate|management|storage)/i.test(
        path
      )
    ) {
      score += 10;
    }

    // 4. Low-value marketing / admin penalty (-30)
    if (LOW_VALUE_PATTERNS.some((pattern) => pattern.test(path))) {
      score -= 30;
    }
  } catch {}

  return score;
}

export async function processCrawlJob(job: Job<CrawlJobData>): Promise<void> {
  const jobStartTime = performance.now();
  const { crawlJobId, sourceId, baseUrl, maxPages = 10, maxDepth = 2 } = job.data;

  console.log(`[CrawlProcessor] Starting job ${job.id} for source ${sourceId} (${baseUrl})`);

  // Update CrawlJob state to RUNNING
  await prisma.crawlJob.update({
    where: { id: crawlJobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  const visited = new Set<string>();
  const queue: QueueItem[] = [{ url: baseUrl, depth: 0, priority: 100 }];

  let pagesProcessed = 0;
  let pagesFailed = 0;

  try {
    while (queue.length > 0 && pagesProcessed < maxPages) {
      const item = queue.shift();
      if (!item) break;

      const { url, depth } = item;

      // Deduplicate visited URLs
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        // 1. SSRF Guard Validation
        const safeUrl = await validateSafeUrl(url);

        // 2. Robots.txt Compliance Check
        const { allowed, crawlDelayMs } = await robotsService.isAllowed(safeUrl);
        if (!allowed) {
          console.log(`[CrawlProcessor] Blocked by robots.txt: ${safeUrl}`);
          continue;
        }

        if (crawlDelayMs && crawlDelayMs > 0) {
          const delay = Math.min(crawlDelayMs, 3000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // 3. HTTP Fetch with timeout & headers
        const response = await axios.get(safeUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'SeekrBot/1.0 (+https://github.com/seekr-search)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          validateStatus: (status) => status >= 200 && status < 300,
          maxRedirects: 3,
        });

        const contentType = String(response.headers['content-type'] || '');
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          console.log(`[CrawlProcessor] Skipping non-HTML resource (${contentType}): ${safeUrl}`);
          continue;
        }

        // 4. Content Extraction & Text Normalization
        const { title, content, links, canonicalUrl } = extractContent(response.data, safeUrl);
        if (canonicalUrl && canonicalUrl !== safeUrl) {
          visited.add(canonicalUrl);
        }

        const { normalizedText, contentHash } = normalizeTextAndHash(content);

        // Skip pages with trivial content
        if (normalizedText.length < 50) {
          console.log(`[CrawlProcessor] Content too short (${normalizedText.length} chars): ${safeUrl}`);
          continue;
        }

        // 5. Explicit Document Persistence & Version Management
        const existingDoc = await prisma.document.findUnique({
          where: { url: safeUrl },
        });

        if (existingDoc) {
          if (existingDoc.contentHash === contentHash) {
            // Unchanged: update crawledAt timestamp without triggering re-indexing
            await prisma.document.update({
              where: { id: existingDoc.id },
              data: { crawledAt: new Date() },
            });
            console.log(`[CrawlProcessor] Document unchanged (hash matched): ${safeUrl}`);
          } else {
            // Content changed: update document record and dispatch update indexing job
            const updated = await prisma.document.update({
              where: { id: existingDoc.id },
              data: {
                title,
                content: normalizedText,
                contentHash,
                updatedAt: new Date(),
                crawledAt: new Date(),
              },
            });

            console.log(`[CrawlProcessor] Document updated, queuing re-indexing: ${safeUrl}`);
            await getIndexerQueue().add('index-doc', {
              documentId: updated.id,
              isUpdate: true,
            });
          }
        } else {
          // New document: persist to PostgreSQL and dispatch indexing job
          const created = await prisma.document.create({
            data: {
              sourceId,
              url: safeUrl,
              title,
              content: normalizedText,
              contentHash,
              language: 'en',
            },
          });

          console.log(`[CrawlProcessor] New document persisted, queuing indexing: ${safeUrl}`);
          await getIndexerQueue().add('index-doc', {
            documentId: created.id,
            isUpdate: false,
          });
        }

        pagesProcessed++;

        // Update progress in DB periodically
        await prisma.crawlJob.update({
          where: { id: crawlJobId },
          data: { pagesProcessed, pagesFailed },
        });

        // 6. Discover and enqueue internal links within depth limit using priority queue
        if (depth < maxDepth && pagesProcessed < maxPages) {
          for (const link of links) {
            if (!visited.has(link) && queue.every((q) => q.url !== link)) {
              const priority = calculateUrlPriority(link, baseUrl);
              queue.push({ url: link, depth: depth + 1, priority });
            }
          }
          // Prioritize documentation URLs (higher priority first, shallower depth first)
          queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
        }
      } catch (pageErr: any) {
        pagesFailed++;
        console.error(`[CrawlProcessor] Failed processing ${url}:`, pageErr.message);
        await prisma.crawlJob.update({
          where: { id: crawlJobId },
          data: { pagesFailed },
        });
      }
    }

    // Mark job as COMPLETED
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        pagesProcessed,
        pagesFailed,
      },
    });

    crawlerJobsProcessedTotal.inc({ status: 'completed' });
    crawlerJobDurationSeconds.observe((performance.now() - jobStartTime) / 1000);

    console.log(
      `[CrawlProcessor] Completed crawl job ${crawlJobId}. Processed: ${pagesProcessed}, Failed: ${pagesFailed}`
    );
  } catch (err: any) {
    console.error(`[CrawlProcessor] Fatal error for job ${crawlJobId}:`, err);
    crawlerJobsProcessedTotal.inc({ status: 'failed' });
    crawlerJobDurationSeconds.observe((performance.now() - jobStartTime) / 1000);
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: 'FAILED',
        errorMessage: err.message || 'Fatal crawler error',
        completedAt: new Date(),
        pagesProcessed,
        pagesFailed,
      },
    });
    throw err;
  }
}
