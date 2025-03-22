import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from './browser/browser-manager.js';
import { ContentExtractor } from './content/content-extractor.js';
import { ExtractedContent } from './types/index.js';

interface WebPageContent {
  url: string;
  title?: string;
  content: string;
  links: Array<{
    url: string;
    text: string;
  }>;
}

/**
 * MCP server for fetching and recursively exploring web content.
 * 
 * This server provides a tool to fetch web page content and explore linked
 * pages up to a specified depth, enabling LLMs to learn about topics by
 * autonomously navigating through related content.
 */
export class DocsFetchServer {
  private server: Server;
  private browserManager: BrowserManager;
  private contentExtractor: ContentExtractor;
  private visitedUrls: Set<string> = new Set();

  constructor() {
    this.server = new Server(
      {
        name: 'docs-fetch-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize components
    this.browserManager = new BrowserManager();
    this.contentExtractor = new ContentExtractor();

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.browserManager.close();
      await this.server.close();
      process.exit(0);
    });
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'fetch_doc_content',
          description: 'Fetch web page content with the ability to explore linked pages up to a specified depth',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the web page to fetch',
              },
              depth: {
                type: 'number',
                description: 'Maximum depth of directory/link exploration (default: 1)',
                minimum: 1,
                maximum: 5,
              },
            },
            required: ['url'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error('Received tool request:', {
        tool: request.params.name,
        arguments: request.params.arguments
      });
      
      if (request.params.name === 'fetch_doc_content') {
        const { url, depth = 1 } = request.params.arguments as { 
          url: string;
          depth?: number;
        };
        
        // Reset visited URLs for each new request
        this.visitedUrls.clear();
        
        try {
          const result = await this.fetchDocContentRecursive(url, depth);
          
          // Format results for better LLM consumption
          const formattedOutput = {
            rootUrl: url,
            explorationDepth: depth,
            pagesExplored: result.length,
            content: result
          };
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedOutput, null, 2),
              },
            ],
          };
        } catch (error: unknown) {
          console.error('Error in fetch_doc_content:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching content: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    });
  }

  /**
   * Recursively fetch content from a URL and its linked pages up to maxDepth
   */
  private async fetchDocContentRecursive(
    url: string, 
    maxDepth: number, 
    currentDepth: number = 0
  ): Promise<WebPageContent[]> {
    if (currentDepth >= maxDepth || this.visitedUrls.has(url)) {
      return [];
    }

    this.visitedUrls.add(url);
    console.error(`Fetching ${url} (depth ${currentDepth}/${maxDepth})`);

    try {
      const content = await this.fetchSinglePage(url);
      
      // Filter and sort links by relevance to make exploration more efficient
      const sortedLinks = content.relatedLinks
        .filter(link => {
          // Skip navigation and utility links that are less likely to contain topical content
          const text = link.text.toLowerCase();
          return !text.match(/^(home|contact|about|login|sign up|register|search|privacy|terms|cookies)$/i);
        })
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10) // Limit to the most relevant links to avoid excessive exploration
        .map(link => ({ 
          url: link.url, 
          text: link.text 
        }));

      // Extract page title from URL if not available
      let pageTitle = "";
      try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1];
          pageTitle = lastSegment
            .replace(/[_-]/g, ' ')
            .replace(/\.\w+$/, '')  // Remove file extension
            .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add spaces between camelCase
            .trim();
        }
      } catch (e) {
        // Ignore errors in title extraction
      }

      const results: WebPageContent[] = [{
        url,
        title: pageTitle,
        content: content.mainContent,
        links: sortedLinks
      }];

      // Recursively fetch content for related links if not at max depth
      if (currentDepth < maxDepth - 1) {
        // Process links in parallel with a concurrency limit to improve speed
        const pendingFetches = [];
        
        for (const link of sortedLinks) {
          const fullUrl = this.resolveUrl(link.url, url);
          if (fullUrl && this.isSameDomain(fullUrl, url) && !this.visitedUrls.has(fullUrl)) {
            pendingFetches.push(
              this.fetchDocContentRecursive(
                fullUrl,
                maxDepth,
                currentDepth + 1
              )
            );
            
            // Limit concurrent requests
            if (pendingFetches.length >= 3) {
              const fetchResults = await Promise.all(pendingFetches);
              fetchResults.forEach(result => results.push(...result));
              pendingFetches.length = 0;
            }
          }
        }
        
        // Process any remaining fetches
        if (pendingFetches.length > 0) {
          const fetchResults = await Promise.all(pendingFetches);
          fetchResults.forEach(result => results.push(...result));
        }
      }

      return results;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      return []; // Skip this URL on error but continue with others
    }
  }

  /**
   * Fetch content from a single web page
   */
  private async fetchSinglePage(url: string): Promise<ExtractedContent> {
    if (!this.browserManager.isValidUrl(url)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid URL provided');
    }

    console.error('Starting page fetch:', url);
    let page = null;
    let browser = null;

    try {
      // Initialize browser with retry logic
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          browser = await this.browserManager.initBrowser();
          page = await browser.newPage();
          break;
        } catch (err) {
          console.error(`Browser initialization attempt ${attempt} failed:`, err);
          if (attempt === 3) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!page) {
        throw new McpError(ErrorCode.InternalError, 'Failed to create browser page');
      }

      // Set timeouts and configure page
      await page.setDefaultNavigationTimeout(60000);
      await page.setDefaultTimeout(60000);
      await page.setViewport({ width: 1200, height: 800 });
      await page.setRequestInterception(true);

      // Handle request interception to block images, stylesheets, etc.
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Navigate with retry logic
      let response = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await page.goto(url, {
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 30000
          });
          break;
        } catch (err) {
          console.error(`Navigation attempt ${attempt} failed:`, err);
          if (attempt === 3) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!response) {
        throw new McpError(ErrorCode.InternalError, 'No response received');
      }

      const status = response.status();
      if (status !== 200) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to load page: HTTP ${status}`
        );
      }

      // Wait for content with timeout
      const contentPromise = Promise.race([
        this.contentExtractor.waitForContent(page),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Content wait timeout')), 30000)
        )
      ]);

      try {
        await contentPromise;
      } catch (err) {
        console.error('Content wait error:', err);
      }

      const hasContent = await this.contentExtractor.hasContent(page);
      if (!hasContent) {
        throw new McpError(ErrorCode.InternalError, 'Page appears to be empty');
      }

      const content = await this.contentExtractor.extractContent(page);
      if (!content.mainContent || content.mainContent.trim().length === 0) {
        throw new McpError(ErrorCode.InternalError, 'Failed to extract content');
      }

      return content;
    } catch (error: unknown) {
      console.error('Error in fetchSinglePage:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch content: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      try {
        if (page) await page.close();
        if (browser) await browser.close();
      } catch (err) {
        console.error('Error during cleanup:', err);
      }
    }
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  private resolveUrl(href: string, base: string): string | null {
    try {
      // Handle absolute URLs
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }
      
      // Skip non-HTTP links
      if (href.startsWith('javascript:') || 
          href.startsWith('mailto:') || 
          href.startsWith('tel:') ||
          href.startsWith('#')) {
        return null;
      }
      
      // Resolve relative URLs
      return new URL(href, base).href;
    } catch (e) {
      console.error('Error resolving URL:', e);
      return null;
    }
  }

  /**
   * Check if two URLs are from the same domain
   */
  private isSameDomain(url1: string, url2: string): boolean {
    try {
      const domain1 = new URL(url1).hostname;
      const domain2 = new URL(url2).hostname;
      return domain1 === domain2;
    } catch (e) {
      return false;
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      console.error('Connecting to transport...');
      await this.server.connect(transport);
      console.error('Documentation fetch MCP server running on stdio');
    } catch (error) {
      console.error('Error starting server:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }
}
