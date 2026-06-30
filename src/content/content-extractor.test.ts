import { expect, test } from 'bun:test';
import { ContentExtractor } from './content-extractor.js';

test('extractFromHtml preserves core documentation structure as markdown', () => {
  const page = new ContentExtractor().extractFromHtml(
    `
      <!doctype html>
      <html>
        <head>
          <title>Docs</title>
          <meta name="description" content="Example documentation">
          <link rel="canonical" href="/docs">
        </head>
        <body>
          <nav><a href="/login">Login</a></nav>
          <main>
            <h1>Docs</h1>
            <p>Welcome to <a href="/docs/api">the API</a>.</p>
            <ul><li>Install</li><li>Configure</li></ul>
            <pre><code>bun install</code></pre>
            <table><tr><th>Name</th><th>Type</th></tr><tr><td>url</td><td>string</td></tr></table>
          </main>
        </body>
      </html>
    `,
    {
      sourceUrl: 'https://example.com/docs',
      status: 200,
      contentLimit: 10_000,
      fetchedWith: 'http',
    }
  );

  expect(page.title).toBe('Docs');
  expect(page.description).toBe('Example documentation');
  expect(page.canonicalUrl).toBe('https://example.com/docs');
  expect(page.headings).toEqual(['Docs']);
  expect(page.content).toContain('# Docs');
  expect(page.content).toContain('[the API](/docs/api)');
  expect(page.content).toContain('- Install');
  expect(page.content).toContain('```');
  expect(page.content).toContain('| Name | Type |');
  expect(page.links.map((link) => link.url)).toContain('https://example.com/docs/api');
});

test('extractFromHtml truncates content with explicit metadata', () => {
  const page = new ContentExtractor().extractFromHtml('<main><p>abcdef</p></main>', {
    sourceUrl: 'https://example.com/docs',
    status: 200,
    contentLimit: 3,
    fetchedWith: 'http',
  });

  expect(page.truncated).toBe(true);
  expect(page.contentLength).toBeGreaterThan(3);
  expect(page.content).toContain('... (content truncated)');
});
