import { describe, it, expect } from 'vitest';
import { extractContent } from '../services/contentExtractor.js';
import { normalizeTextAndHash } from '../services/normalizer.js';

describe('Content Extractor & Normalizer', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Redis In-Memory Database Guide</title>
      <meta property="og:title" content="Redis In-Memory Database Guide" />
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
        <p>This allows the dataset to be reconstructed when the server restarts.</p>
        <a href="/wiki/AOF">Learn more about AOF</a>
        <a href="https://external.com/page">External Link</a>
      </main>
      <footer>
        <p>Copyright 2026. All rights reserved.</p>
      </footer>
    </body>
    </html>
  `;

  it('extracts title and removes navigation/footer noise', () => {
    const { title, content, links } = extractContent(sampleHtml, 'https://redis.io/docs/persistence');

    expect(title).toBe('Redis In-Memory Database Guide');
    expect(content).toContain('Understanding Redis Persistence');
    expect(content).toContain('Redis supports AOF persistence');
    expect(content).not.toContain('analytics tracking');
    expect(content).not.toContain('Copyright 2026');
    expect(content).not.toContain('font-size: 16px');

    // Internal link discovered, external link filtered
    expect(links).toContain('https://redis.io/wiki/AOF');
    expect(links).not.toContain('https://external.com/page');
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
});
