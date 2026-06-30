#!/usr/bin/env bun
import { DocsFetchServer } from './server.js';

/**
 * Docs Fetch MCP Server
 * 
 * This server fetches documentation content and can perform a bounded crawl of
 * same-origin links. It returns Markdown content, ranked links, crawl metadata,
 * and per-page errors.
 * 
 * Available tool:
 * - fetch_doc_content: Fetch a page or crawl linked pages up to the requested
 *   depth and page/time limits.
 */

const server = new DocsFetchServer();
server.run().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
