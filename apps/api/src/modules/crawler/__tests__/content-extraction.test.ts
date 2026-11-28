import { describe, it, expect } from 'vitest';
import { extractContent, WikipediaExtractor, GeneralHtmlExtractor } from '../extractors/index.js';

describe('Content Extraction Pipeline', () => {
  it('correctly extracts and cleans Wikipedia article HTML', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Paris - Wikipedia</title>
          <link rel="canonical" href="https://en.wikipedia.org/wiki/Paris" />
        </head>
        <body>
          <div id="content">
            <h1 id="firstHeading">Paris</h1>
            <div class="mw-parser-output">
              <span id="coordinates">Coordinates: 48°51′N 2°21′E</span>
              <table class="infobox geography vcard">
                <tr><th>Country</th><td>France</td></tr>
                <tr><td colspan="2"><table class="nested"><tr><td>Nested data</td></tr></table></td></tr>
              </table>
              <div class="hatnote">For other uses, see Paris (disambiguation).</div>
              <p>Paris is the <b>capital</b> and most populous city of France.<sup class="reference"><a href="#cite_1">[1]</a></sup></p>
              <span class="mw-editsection"><a href="#">edit</a></span>
              <h2>History</h2>
              <p>The Parisii tribe founded the city in the 3rd century BC.</p>
              <div class="navbox">Navigation links here</div>
              <div id="catlinks" class="catlinks">Category: Cities in France</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = extractContent(rawHtml, 'https://en.wikipedia.org/wiki/Paris');
    expect(result.title).toBe('Paris');
    expect(result.canonicalUrl).toBe('https://en.wikipedia.org/wiki/Paris');

    // Infobox, hatnotes, editsection, citations, navbox, catlinks must be stripped
    expect(result.content).not.toContain('infobox');
    expect(result.content).not.toContain('Nested data');
    expect(result.content).not.toContain('Navigation links here');
    expect(result.content).not.toContain('[1]');
    expect(result.content).not.toContain('edit');
    expect(result.content).not.toContain('Category: Cities in France');

    // Core content preserved
    expect(result.content).toContain('Paris is the capital and most populous city of France.');
    expect(result.content).toContain('History');
    expect(result.content).toContain('The Parisii tribe founded the city');
  });

  it('cleans general web HTML page and removes navigation boilerplate', () => {
    const generalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Docker Bridge Networking Guide</title>
          <link rel="canonical" href="https://docs.docker.com/network/drivers/bridge" />
        </head>
        <body>
          <nav><ul><li>Home</li><li>Docs</li></ul></nav>
          <header><h1>Header Navigation</h1></header>
          <main>
            <h1>Bridge Network Driver</h1>
            <p>In terms of networking, a bridge network is a Link Layer device.</p>
            <pre><code>docker network create -d bridge my-bridge</code></pre>
          </main>
          <footer><p>Copyright 2026 Docker Inc.</p></footer>
        </body>
      </html>
    `;

    const result = extractContent(generalHtml, 'https://docs.docker.com/network/drivers/bridge');
    expect(result.title).toBe('Docker Bridge Networking Guide');
    expect(result.canonicalUrl).toBe('https://docs.docker.com/network/drivers/bridge');
    expect(result.content).not.toContain('Home');
    expect(result.content).not.toContain('Header Navigation');
    expect(result.content).not.toContain('Copyright 2026');
    expect(result.content).toContain('In terms of networking, a bridge network is a Link Layer device.');
    expect(result.content).toContain('docker network create -d bridge my-bridge');
  });

  it('handles empty or malformed HTML gracefully', () => {
    const emptyResult = extractContent('', 'https://example.com');
    expect(emptyResult.title).toBe('Web Document');
    expect(emptyResult.content).toBe('');

    const malformed = '<div><p>Unclosed paragraph <b>bold text';
    const malformedResult = extractContent(malformed, 'https://example.com/test');
    expect(malformedResult.content).toContain('Unclosed paragraph bold text');
  });
});
