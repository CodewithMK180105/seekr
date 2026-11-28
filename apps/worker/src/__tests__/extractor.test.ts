import { describe, it, expect } from 'vitest';
import { extractContent } from '../services/contentExtractor.js';
import { normalizeTextAndHash } from '../services/normalizer.js';
import { calculateUrlPriority } from '../processors/crawlProcessor.js';

describe('Content Extractor & Normalizer', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Redis In-Memory Database Guide</title>
      <meta property="og:title" content="Redis In-Memory Database Guide" />
      <link rel="canonical" href="https://redis.io/docs/latest/operate/persistence?utm_source=docs" />
      <style>body { font-size: 16px; }</style>
      <script>console.log("analytics tracking");</script>
    </head>
    <body>
      <header>
        <nav><a href="/home">Home</a> <a href="/about">About</a></nav>
      </header>
      <aside class="sidebar">
        <ul><li><a href="/ad">Ad Link</a></li></ul>
      </aside>
      <main id="content">
        <h1>Understanding Redis Persistence</h1>
        <p>Redis supports AOF persistence which logs every write operation received by the server.</p>
        <pre><code>save 60 1000</code></pre>
        <h2>Snapshotting Mechanics</h2>
        <p>This allows the dataset to be reconstructed when the server restarts.</p>
        <a href="/wiki/AOF?utm_campaign=winter&ref=nav#section-1">Learn more about AOF</a>
        <a href="https://external.com/page">External Link</a>
        <a href="/downloads/redis.tar.gz">Download Tarball</a>
      </main>
      <footer>
        <p>Copyright 2026. All rights reserved.</p>
      </footer>
    </body>
    </html>
  `;

  it('extracts title, canonical URL, and removes navigation/footer noise', () => {
    const { title, content, links, canonicalUrl } = extractContent(
      sampleHtml,
      'https://redis.io/docs/persistence'
    );

    expect(title).toBe('Redis In-Memory Database Guide');
    expect(canonicalUrl).toBe('https://redis.io/docs/latest/operate/persistence');
    expect(content).toContain('Understanding Redis Persistence');
    expect(content).toContain('## Snapshotting Mechanics');
    expect(content).toContain('```');
    expect(content).toContain('save 60 1000');
    expect(content).toContain('Redis supports AOF persistence');
    expect(content).not.toContain('analytics tracking');
    expect(content).not.toContain('Copyright 2026');
    expect(content).not.toContain('font-size: 16px');

    // Internal link discovered with tracking parameters stripped, anchor stripped
    expect(links).toContain('https://redis.io/wiki/AOF');
    // External link and static tarball ignored
    expect(links).not.toContain('https://external.com/page');
    expect(links).not.toContain('https://redis.io/downloads/redis.tar.gz');
  });

  it('normalizes text and computes deterministic SHA-256 hash', () => {
    const textA = '   Understanding   Redis\n\n\n\nPersistence.  \u00A0 AOF logs writes.   ';
    const textB = 'Understanding Redis\n\nPersistence. AOF logs writes.';

    const resultA = normalizeTextAndHash(textA);
    const resultB = normalizeTextAndHash(textB);

    expect(resultA.normalizedText).toBe(resultB.normalizedText);
    expect(resultA.contentHash).toBe(resultB.contentHash);
    expect(resultA.contentHash).toHaveLength(64);
  });

  describe('calculateUrlPriority', () => {
    const rootUrl = 'https://redis.io/docs/';

    it('prioritizes technical documentation paths over marketing pages', () => {
      const docPriority = calculateUrlPriority('https://redis.io/docs/operate/persistence', rootUrl);
      const blogPriority = calculateUrlPriority('https://redis.io/blog/redis-7-released', rootUrl);
      const pricingPriority = calculateUrlPriority('https://redis.io/pricing', rootUrl);

      expect(docPriority).toBeGreaterThan(blogPriority);
      expect(docPriority).toBeGreaterThan(pricingPriority);
      expect(docPriority).toBeGreaterThan(0);
      expect(blogPriority).toBeLessThan(0);
    });

    it('prioritizes specific technical keywords like persistence and snapshot', () => {
      const persistencePriority = calculateUrlPriority(
        'https://redis.io/docs/persistence-guide',
        rootUrl
      );
      const generalDocPriority = calculateUrlPriority(
        'https://redis.io/docs/general',
        rootUrl
      );

      expect(persistencePriority).toBeGreaterThan(generalDocPriority);
    });
  });
});
