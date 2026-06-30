import { expect, test } from 'bun:test';
import { ContentExtractor } from '../content/content-extractor.js';
import { DefaultPageFetcher } from './page-fetcher.js';
import { normalizeOptions } from './docs-crawler.js';

test('render auto preserves current behavior by extracting browser fallback responses regardless of status', async () => {
  const fetcher = new DefaultPageFetcher(
    {
      renderHtml: async () => ({
        html: '<main><h1>Not Found</h1><p>Browser fallback body.</p></main>',
        finalUrl: 'https://example.com/missing',
        status: 404,
      }),
      close: async () => undefined,
    },
    new ContentExtractor(),
    {
      get: async () => {
        throw new Error('HTTP failed');
      },
    }
  );

  const page = await fetcher.fetchPage(
    'https://example.com/missing',
    normalizeOptions({ url: 'https://example.com/missing', render: 'auto' }),
    Date.now()
  );

  expect(page.status).toBe(404);
  expect(page.fetchedWith).toBe('browser');
  expect(page.content).toContain('# Not Found');
});
