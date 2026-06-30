import { expect, test } from 'bun:test';
import { DocsCrawler } from './docs-crawler.js';
import { ExtractedPage, NormalizedCrawlOptions } from '../types/index.js';
import { PageFetcher } from './page-fetcher.js';

const ORIGIN = 'https://example.com';

test('crawl depth controls link distance from the root page', async () => {
  const crawler = new DocsCrawler(new FixturePageFetcher());
  const rootUrl = `${ORIGIN}/docs`;

  const depthOne = await crawler.crawl({
    url: rootUrl,
    depth: 1,
    render: 'never',
    maxPages: 10,
  });
  expect(depthOne.content.map((page) => page.finalUrl)).toEqual([rootUrl]);

  const depthTwo = await crawler.crawl({
    url: rootUrl,
    depth: 2,
    render: 'never',
    maxPages: 10,
  });
  expect(depthTwo.pagesExplored).toBe(4);
  expect(depthTwo.content.some((page) => page.finalUrl === `${ORIGIN}/docs/a`)).toBe(true);
  expect(depthTwo.content.some((page) => page.finalUrl === `${ORIGIN}/docs/b`)).toBe(true);
  expect(depthTwo.content.some((page) => page.finalUrl === `${ORIGIN}/blog`)).toBe(true);
  expect(depthTwo.content.some((page) => page.finalUrl === `${ORIGIN}/docs/c`)).toBe(false);

  const depthThree = await crawler.crawl({
    url: rootUrl,
    depth: 3,
    render: 'never',
    maxPages: 10,
  });
  expect(depthThree.content.some((page) => page.finalUrl === `${ORIGIN}/docs/c`)).toBe(true);
});

test('crawl respects pathPrefix and records per-page failures', async () => {
  const result = await new DocsCrawler(new FixturePageFetcher()).crawl({
    url: `${ORIGIN}/docs`,
    depth: 2,
    render: 'never',
    maxPages: 10,
    pathPrefix: '/docs',
  });

  expect(result.content.some((page) => page.finalUrl === `${ORIGIN}/blog`)).toBe(false);
  expect(result.errors.some((error) => error.url === `${ORIGIN}/docs/missing`)).toBe(true);
});

test('includeLinks false hides links without disabling traversal', async () => {
  const result = await new DocsCrawler(new FixturePageFetcher()).crawl({
    url: `${ORIGIN}/docs`,
    depth: 2,
    render: 'never',
    maxPages: 10,
    includeLinks: false,
  });

  expect(result.pagesExplored > 1).toBe(true);
  expect(result.content.every((page) => page.links.length === 0)).toBe(true);
});

test('sameOrigin false allows external traversal', async () => {
  const result = await new DocsCrawler(new FixturePageFetcher()).crawl({
    url: `${ORIGIN}/docs`,
    depth: 2,
    render: 'never',
    maxPages: 10,
    sameOrigin: false,
  });

  expect(result.content.some((page) => page.finalUrl === 'https://external.example/docs/x')).toBe(true);
});

class FixturePageFetcher implements PageFetcher {
  async fetchPage(url: string, _options: NormalizedCrawlOptions): Promise<ExtractedPage> {
    const page = FIXTURES.get(url);
    if (!page) {
      const error = new Error('Request failed with status code 404') as Error & {
        response?: { status: number };
      };
      error.response = { status: 404 };
      throw error;
    }

    return page;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

const FIXTURES = new Map<string, ExtractedPage>([
  [
    `${ORIGIN}/docs`,
    page('Docs Home', `${ORIGIN}/docs`, [
      [`${ORIGIN}/docs/a`, 'API guide', 20],
      [`${ORIGIN}/docs/b`, 'Tutorial guide', 18],
      [`${ORIGIN}/blog`, 'Blog', 16],
      [`${ORIGIN}/docs/missing`, 'Missing page', 14],
      ['https://external.example/docs/x', 'External docs', 12, false],
    ]),
  ],
  [
    `${ORIGIN}/docs/a`,
    page('API Guide', `${ORIGIN}/docs/a`, [[`${ORIGIN}/docs/c`, 'Reference API', 20]]),
  ],
  [`${ORIGIN}/docs/b`, page('Tutorial Guide', `${ORIGIN}/docs/b`, [])],
  [`${ORIGIN}/docs/c`, page('Reference API', `${ORIGIN}/docs/c`, [])],
  [`${ORIGIN}/blog`, page('Blog', `${ORIGIN}/blog`, [])],
  ['https://external.example/docs/x', page('External Docs', 'https://external.example/docs/x', [])],
]);

function page(
  title: string,
  url: string,
  links: Array<[url: string, text: string, score: number, internal?: boolean]>
): ExtractedPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    title,
    headings: [title],
    content: `# ${title}\n\nFixture content for ${title}.`,
    contentLength: 80,
    truncated: false,
    fetchedWith: 'http',
    links: links.map(([linkUrl, text, score, internal = true]) => ({
      url: linkUrl,
      text,
      score,
      internal,
    })),
  };
}
