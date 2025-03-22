#!/usr/bin/env node
import { DocsFetchServer } from './server.js';

/**
 * Docs Fetch MCP Server
 * 
 * This server provides a simple way to fetch web page content with the ability to 
 * explore linked pages up to a specified depth. It returns the main content of 
 * the page along with links that can be further explored.
 * 
 * Available tool:
 * - fetch_doc_content: Fetch web page content with links, allowing for 
 *   recursive exploration of same-domain pages up to the specified depth.
 */

const server = new DocsFetchServer();
server.run().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
