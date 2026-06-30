# Docs Fetch MCP Server

A Bun-based Model Context Protocol (MCP) server for fetching documentation pages and bounded documentation crawls.

The server exposes one MCP tool, `fetch_doc_content`. It fetches a root URL, extracts readable Markdown, ranks links, and can crawl linked pages within explicit depth, page, timeout, and scope limits. Results are returned as structured JSON with crawl metadata, page content, ranked links, truncation flags, and per-page errors.

## Features

- Fast static fetch path with `axios`
- Optional Puppeteer rendering for client-rendered or thin pages
- Markdown extraction with headings, lists, code blocks, tables, blockquotes, and links
- Real crawl depth semantics:
  - `depth: 1` returns only the root page
  - `depth: 2` includes direct child links
  - `depth: 3` includes grandchildren, up to the maximum of `5`
- URL normalization before dedupe: fragments, tracking params, default ports, and trailing slash duplicates are removed
- Crawl scoping by same origin and optional `pathPrefix`
- Bounded `maxPages`, `maxConcurrency`, global timeout, per-page timeout, and per-page content truncation
- Partial results with explicit per-page failures
- Runtime argument validation shared with the advertised tool schema

## Requirements

- Bun `>=1.3.0`
- Puppeteer's browser installation if `render` is `auto` or `always`

This project uses Bun for dependency management, runtime execution, builds, and tests.

## Installation

```bash
bun install
bun run build
```

Configure your MCP client:

```json
{
  "mcpServers": {
    "docs-fetch": {
      "command": "bun",
      "args": ["/path/to/docs-fetch-mcp/build/index.js"]
    }
  }
}
```

For local development without a build:

```json
{
  "mcpServers": {
    "docs-fetch": {
      "command": "bun",
      "args": ["/path/to/docs-fetch-mcp/src/index.ts"]
    }
  }
}
```

## Tool

### `fetch_doc_content`

Fetch one URL and optionally crawl linked pages.

Parameters:

| Name | Type | Default | Limit | Description |
|---|---:|---:|---:|---|
| `url` | string | required | HTTP/HTTPS only | Root URL to fetch. |
| `depth` | number | `1` | `1` to `5` | Link distance from the root. |
| `maxPages` | number | `10` | `1` to `50` | Maximum pages returned across the crawl. |
| `maxConcurrency` | number | `3` | `1` to `8` | Maximum pages fetched at once. |
| `timeoutMs` | number | `45000` | `5000` to `120000` | Global crawl timeout. |
| `perPageTimeoutMs` | number | `10000` | `1000` to `60000` | Per-page fetch timeout. |
| `render` | string | `auto` | `auto`, `always`, `never` | Browser rendering strategy. |
| `sameOrigin` | boolean | `true` | n/a | Restrict crawled links to the same origin. |
| `pathPrefix` | string | omitted | n/a | Optional path prefix crawl scope, such as `/docs`. |
| `contentLimit` | number | `12000` | `1000` to `50000` | Markdown characters per page before truncation. |
| `includeLinks` | boolean | `true` | n/a | Include ranked links in returned page objects. |

Example request:

```json
{
  "url": "https://example.com/docs",
  "depth": 2,
  "maxPages": 8,
  "pathPrefix": "/docs",
  "render": "auto"
}
```

Response shape:

```json
{
  "rootUrl": "https://example.com/docs",
  "normalizedRootUrl": "https://example.com/docs",
  "explorationDepth": 2,
  "maxPages": 8,
  "pagesExplored": 3,
  "pagesFailed": 1,
  "timedOut": false,
  "durationMs": 1234,
  "crawl": {
    "sameOrigin": true,
    "pathPrefix": "/docs",
    "maxConcurrency": 3,
    "render": "auto",
    "perPageTimeoutMs": 10000
  },
  "content": [
    {
      "url": "https://example.com/docs",
      "finalUrl": "https://example.com/docs",
      "depth": 0,
      "status": 200,
      "title": "Documentation",
      "description": "Example documentation",
      "canonicalUrl": "https://example.com/docs",
      "headings": ["Documentation"],
      "content": "# Documentation\n\n...",
      "contentLength": 2400,
      "truncated": false,
      "fetchedWith": "http",
      "links": [
        {
          "url": "https://example.com/docs/api",
          "text": "API reference",
          "score": 18.5,
          "internal": true
        }
      ]
    }
  ],
  "errors": [
    {
      "url": "https://example.com/docs/missing",
      "depth": 1,
      "error": "Request failed with status code 404",
      "status": 404
    }
  ]
}
```

## Crawl Behavior

- Crawling is breadth-first.
- URLs are normalized before dedupe and enqueue.
- `sameOrigin: true` rejects links whose origin differs from the normalized root URL.
- `pathPrefix` further restricts links to a path prefix on the root origin.
- `includeLinks: false` hides links in returned page objects but does not disable link discovery for crawling.
- `render: "never"` uses only the HTTP fetch path.
- `render: "always"` uses Puppeteer for every fetched page.
- `render: "auto"` tries HTTP first, then uses Puppeteer when HTTP fails or extracted content is very thin.
- Browser fallback currently preserves the rendered response status and extracts the page body even for non-2xx pages.

## Architecture

```text
src/index.ts                         CLI entrypoint
src/server.ts                        MCP server wiring and tool registration
src/config/tool-options.ts           Shared tool schema/default/range metadata
src/tool/fetch-doc-content-args.ts   Runtime argument validation
src/crawler/docs-crawler.ts          Crawl orchestration and queue management
src/crawler/page-fetcher.ts          HTTP fetch, browser fallback, extraction coordination
src/browser/browser-manager.ts       Reusable Puppeteer browser/page handling
src/content/content-extractor.ts     Page metadata/content extraction facade
src/content/main-content-selector.ts Main content selection
src/content/link-extractor.ts        Link normalization, dedupe, and ranking
src/content/markdown-renderer.ts     HTML-to-Markdown rendering
src/content/text-cleanup.ts          Shared text normalization helpers
src/utils/url.ts                     URL normalization and scope utilities
src/types/index.ts                   Shared TypeScript types
```

The MCP schema and runtime option normalization share the same metadata source in `src/config/tool-options.ts`. Keep new options there first, then wire behavior through validation and crawler options.

## Development

```bash
bun install
bun run dev
bun run test
bun run typecheck
bun run build
```

Scripts:

- `bun run dev`: run the MCP server from TypeScript source.
- `bun run test`: run Bun tests under `src`.
- `bun run typecheck`: run TypeScript with `--noEmit`.
- `bun run build`: emit `build/index.js` with a Bun shebang.
- `bun run start`: run the built MCP server.

## Testing

Tests are colocated with the modules they cover:

- `src/crawler/docs-crawler.test.ts`: crawl depth, scoping, failures, and link visibility.
- `src/crawler/page-fetcher.test.ts`: fetch/render fallback characterization.
- `src/content/content-extractor.test.ts`: Markdown extraction and truncation.
- `src/tool/fetch-doc-content-args.test.ts`: boundary validation and schema/default sync.
- `src/utils/url.test.ts`: URL normalization and scope helpers.

When changing behavior, add or update characterization tests first. For refactors, keep `bun run test`, `bun run typecheck`, and `bun run build` green.

## Notes

- Use `render: "never"` for fast static documentation crawls and tests.
- Use `pathPrefix` for documentation sites that share a domain with marketing pages, blogs, or apps.
- Puppeteer browser installation can be skipped only if callers use `render: "never"`.
- The custom Markdown renderer is intentionally covered by characterization tests; preserve output compatibility unless making an explicit behavior change.

## License

MIT
