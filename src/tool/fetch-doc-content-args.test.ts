import { expect, test } from 'bun:test';
import { normalizeOptions } from '../crawler/docs-crawler.js';
import { buildFetchDocContentInputSchema } from '../config/tool-options.js';

test('normalizeOptions validates optional boundary argument types', () => {
  expect(() => normalizeOptions({ url: 'https://example.com', sameOrigin: 'false' })).toThrow(
    'sameOrigin must be a boolean'
  );
  expect(() => normalizeOptions({ url: 'https://example.com', includeLinks: 'false' })).toThrow(
    'includeLinks must be a boolean'
  );
  expect(() => normalizeOptions({ url: 'https://example.com', pathPrefix: {} })).toThrow(
    'pathPrefix must be a string'
  );
});

test('tool schema and runtime option defaults stay in sync', () => {
  const schema = buildFetchDocContentInputSchema();
  const options = normalizeOptions({ url: 'https://example.com/docs' });

  expect(schema.properties.depth.default).toBe(options.maxDepth);
  expect(schema.properties.maxPages.default).toBe(options.maxPages);
  expect(schema.properties.maxConcurrency.default).toBe(options.maxConcurrency);
  expect(schema.properties.timeoutMs.default).toBe(options.timeoutMs);
  expect(schema.properties.perPageTimeoutMs.default).toBe(options.perPageTimeoutMs);
  expect(schema.properties.render.default as string).toBe(options.render);
  expect(schema.properties.sameOrigin.default as boolean).toBe(options.sameOrigin);
  expect(schema.properties.contentLimit.default).toBe(options.contentLimit);
  expect(schema.properties.includeLinks.default as boolean).toBe(options.includeLinks);
});
