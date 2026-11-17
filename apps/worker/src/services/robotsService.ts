import robotsParserModule from 'robots-parser';
import axios from 'axios';

// Handle CommonJS / ESM interoperability for robots-parser
const robotsParser: (url: string, contents: string) => any =
  typeof (robotsParserModule as any) === 'function'
    ? (robotsParserModule as any)
    : (robotsParserModule as any).default;

interface RobotsCacheEntry {
  parser: any;
  expiresAt: number;
}

const robotsCache = new Map<string, RobotsCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class RobotsService {
  private userAgent = 'SeekrBot/1.0 (+https://github.com/seekr-search)';

  async isAllowed(targetUrl: string): Promise<{ allowed: boolean; crawlDelayMs?: number }> {
    try {
      const parsed = new URL(targetUrl);
      const origin = parsed.origin;
      const robotsUrl = `${origin}/robots.txt`;

      let parser = this.getCached(origin);

      if (!parser) {
        try {
          const res = await axios.get(robotsUrl, {
            timeout: 5000,
            headers: { 'User-Agent': this.userAgent },
            validateStatus: (status) => status < 500,
          });

          if (res.status === 200 && typeof res.data === 'string') {
            parser = robotsParser(robotsUrl, res.data);
          } else {
            // 404 or other non-200 means no restrictions
            parser = robotsParser(robotsUrl, '');
          }
        } catch {
          // If robots.txt cannot be fetched, default to permissive
          parser = robotsParser(robotsUrl, '');
        }

        this.setCached(origin, parser);
      }

      const allowed = parser.isAllowed(targetUrl, this.userAgent) ?? true;
      const crawlDelay = parser.getCrawlDelay(this.userAgent);
      const crawlDelayMs = crawlDelay ? Math.round(crawlDelay * 1000) : undefined;

      return { allowed, crawlDelayMs };
    } catch {
      return { allowed: true };
    }
  }

  private getCached(origin: string): any | null {
    const entry = robotsCache.get(origin);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      robotsCache.delete(origin);
      return null;
    }
    return entry.parser;
  }

  private setCached(origin: string, parser: any): void {
    robotsCache.set(origin, {
      parser,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}

export const robotsService = new RobotsService();
