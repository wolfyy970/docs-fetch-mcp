# Docs Fetch MCP Server

A Model Context Protocol (MCP) server for fetching web content with recursive exploration capabilities. This server enables LLMs to autonomously explore web pages and documentation to learn about specific topics.

## Overview

The Docs Fetch MCP Server provides a simple but powerful way for LLMs to retrieve and explore web content. It enables:

- Fetching clean, readable content from any web page
- Recursive exploration of linked pages up to a specified depth
- Same-domain link traversal to gather comprehensive information
- Smart filtering of navigation links to focus on content-rich pages

This tool is particularly useful when users want an LLM to learn about a specific topic by exploring documentation or web content.

## Features

- **Content Extraction**: Cleanly extracts the main content from web pages, removing distractions like navigation, ads, and irrelevant elements
- **Link Analysis**: Identifies and extracts links from the page, assessing their relevance
- **Recursive Exploration**: Follows links to related content within the same domain, up to a specified depth
- **Parallel Processing**: Efficiently crawls content with concurrent requests and proper error handling
- **Robust Error Handling**: Gracefully handles network issues, timeouts, and malformed pages
- **Dual-Strategy Approach**: Uses fast axios requests first with puppeteer as a fallback for more complex pages
- **Timeout Prevention**: Implements global timeout handling to ensure reliable operation within MCP time limits
- **Partial Results**: Returns available content even when some pages fail to load completely

## Usage

The server exposes a single MCP tool:

### `fetch_doc_content`

Fetches web page content with the ability to explore linked pages up to a specified depth.

**Parameters:**
- `url` (string, required): URL of the web page to fetch
- `depth` (number, optional, default: 1): Maximum depth of directory/link exploration (1-5)

**Returns:**
```json
{
  "rootUrl": "https://example.com/docs",
  "explorationDepth": 2,
  "pagesExplored": 5,
  "content": [
    {
      "url": "https://example.com/docs",
      "title": "Documentation",
      "content": "Main page content...",
      "links": [
        {
          "url": "https://example.com/docs/topic1",
          "text": "Topic 1"
        },
        ...
      ]
    },
    ...
  ]
}
```

## Installation

1. Clone this repository:
```bash
git clone https://github.com/wolfyy970/docs-fetch-mcp.git
cd docs-fetch-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure your MCP settings in your Claude Client:
```json
{
  "mcpServers": {
    "docs-fetch": {
      "command": "node",
      "args": [
        "/path/to/docs-fetch-mcp/build/index.js"
      ],
      "env": {
        "MCP_TRANSPORT": "pipe"
      }
    }
  }
}
```

## Dependencies

- `@modelcontextprotocol/sdk`: MCP server SDK
- `puppeteer`: Headless browser for web page interaction
- `axios`: HTTP client for making requests

## Development

To run the server in development mode:

```bash
npm run dev
```

## License

MIT
