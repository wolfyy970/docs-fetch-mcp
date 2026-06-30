import { expect, test } from 'bun:test';
import { isInPathPrefix, normalizeUrl, sameOrigin } from './url.js';

test('normalizeUrl removes fragments, tracking params, default ports, and duplicate slash suffixes', () => {
  expect(
    normalizeUrl('HTTPS://Example.COM:443/docs/?b=2&utm_source=test&a=1#install'),
  ).toBe('https://example.com/docs?a=1&b=2');
});

test('normalizeUrl rejects unsupported protocols', () => {
  expect(normalizeUrl('mailto:test@example.com')).toBeNull();
  expect(normalizeUrl('javascript:alert(1)')).toBeNull();
});

test('sameOrigin compares protocol, host, and port', () => {
  expect(sameOrigin('https://example.com/docs', 'https://example.com/api')).toBe(true);
  expect(sameOrigin('https://example.com/docs', 'http://example.com/docs')).toBe(false);
});

test('isInPathPrefix applies an optional same-origin path scope', () => {
  expect(isInPathPrefix('https://example.com/docs/api', 'https://example.com/docs', '/docs')).toBe(true);
  expect(isInPathPrefix('https://example.com/blog', 'https://example.com/docs', '/docs')).toBe(false);
  expect(isInPathPrefix('https://other.com/docs', 'https://example.com/docs', '/docs')).toBe(false);
});
