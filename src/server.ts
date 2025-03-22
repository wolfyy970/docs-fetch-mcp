import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
import axios from 'axios';

/**
 * Simplified MCP server for fetching web content.
 * 
 * This server provides a streamlined implementation that focuses on reliability
 * and avoids timeout issues. It fetches web page content and can explore linked
 * pages up to a specified depth.
 */
export class DocsFetchServer {
  private server: Server;
  private visitedUrls: Set<string> = new Set();
  private globalTimeout: NodeJS.Timeout | null = null;
  private timeoutDuration = 45000; // 45 seconds - below MCP's 60s timeout

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

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      if (this.globalTimeout) {
        clearTimeout(this.globalTimeout);
      }
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
      if (request.params.name === 'fetch_doc_content') {
        const { url, depth = 1 } = request.params.arguments as { 
          url: string;
          depth?: number;
        };
        
        // Reset visited URLs for each new request
        this.visitedUrls.clear();
        
        // Setup global timeout
        let timeoutError: Error | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          this.globalTimeout = setTimeout(() => {
            timeoutError = new Error('Operation timed out');
            reject(timeoutError);
          }, this.timeoutDuration);
        });
        
        try {
          // Race the content fetch against our timeout
          const result = await Promise.race([
            this.fetchContent(url, depth),
            timeoutPromise
          ]);
          
          // Clear timeout if we didn't hit it
          if (this.globalTimeout) {
            clearTimeout(this.globalTimeout);
            this.globalTimeout = null;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: unknown) {
          // Clear timeout if we hit an error
          if (this.globalTimeout) {
            clearTimeout(this.globalTimeout);
            this.globalTimeout = null;
          }
          
          let errorMessage = "Unknown error occurred";
          if (error === timeoutError) {
            errorMessage = "Operation timed out before completion";
          } else if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
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
   * Main content fetching function with simplified implementation
   */
  private async fetchContent(url: string, maxDepth: number): Promise<any> {
    // Track visited URLs to avoid cycles
    this.visitedUrls.add(url);
    
    try {
      // First try a simple fetch with axios as a faster alternative
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // If we got HTML content, use it
        if (response.status === 200 && response.data && typeof response.data === 'string') {
          const mainContent = this.extractTextContent(response.data);
          const links = this.extractLinks(response.data, url);
          
          // For depth=1, just return the main content
          if (maxDepth <= 1) {
            return {
              rootUrl: url,
              explorationDepth: maxDepth,
              pagesExplored: 1,
              content: [{
                url,
                content: mainContent,
                links: links.slice(0, 10) // Limit to top 10 links
              }]
            };
          }
          
          // For depth > 1, explore child links
          const childResults = [];
          const limit = Math.min(5, links.length); // Limit to 5 links for performance
          
          for (let i = 0; i < limit; i++) {
            const link = links[i];
            if (!this.visitedUrls.has(link.url)) {
              try {
                const childContent = await this.fetchSimpleContent(link.url);
                if (childContent) {
                  childResults.push({
                    url: link.url,
                    content: childContent,
                    links: [] // Don't include links for child pages
                  });
                  this.visitedUrls.add(link.url);
                }
              } catch (e) {
                // Ignore errors on child pages
              }
            }
          }
          
          return {
            rootUrl: url,
            explorationDepth: maxDepth,
            pagesExplored: 1 + childResults.length,
            content: [{
              url,
              content: mainContent,
              links: links.slice(0, 10)
            }, ...childResults]
          };
        }
      } catch (e) {
        // Fall back to puppeteer if axios fails
        console.error('Axios fetch failed, falling back to puppeteer:', e);
      }
      
      // Fall back to puppeteer for more complex pages
      return await this.fetchWithPuppeteer(url, maxDepth);
    } catch (error) {
      console.error('Error in content fetch:', error);
      // Return partial results if we have visited any URLs
      if (this.visitedUrls.size > 0) {
        return {
          rootUrl: url,
          explorationDepth: maxDepth,
          pagesExplored: this.visitedUrls.size,
          content: [],
          error: error instanceof Error ? error.message : String(error)
        };
      }
      throw error;
    }
  }
  
  /**
   * Simple content fetching for child pages
   */
  private async fetchSimpleContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.status === 200 && response.data && typeof response.data === 'string') {
        return this.extractTextContent(response.data);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Extract plain text content from HTML
   */
  private extractTextContent(html: string): string {
    // Very basic HTML to text conversion
    let text = html
      .replace(/<head>[\s\S]*?<\/head>/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Truncate if too long
    if (text.length > 10000) {
      text = text.substring(0, 10000) + '... (content truncated)';
    }
    
    return text;
  }
  
  /**
   * Extract links from HTML
   */
  private extractLinks(html: string, baseUrl: string): Array<{url: string, text: string}> {
    const links: Array<{url: string, text: string}> = [];
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"(?:\s+[^>]*?)?>([^<]*)<\/a>/gi;
    
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1].trim();
      const text = match[2].trim();
      
      // Skip empty links or special protocols
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || 
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }
      
      try {
        // Resolve relative URLs
        const fullUrl = new URL(href, baseUrl).href;
        
        // Only include links from same domain
        if (new URL(fullUrl).hostname === new URL(baseUrl).hostname) {
          links.push({
            url: fullUrl,
            text: text || fullUrl
          });
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
    
    return links;
  }
  
  /**
   * Fetch content using puppeteer for more complex pages
   */
  private async fetchWithPuppeteer(url: string, maxDepth: number): Promise<any> {
    let browser = null;
    
    try {
      // Launch browser with minimal options
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(15000);
      await page.setRequestInterception(true);
      
      // Block unnecessary resources
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      // Wait briefly for any scripts to run
      await page.waitForTimeout(1000);
      
      // Extract content
      const content = await page.evaluate(() => {
        // Try to find main content
        const selectors = [
          '.markdown-body', '.readme', '.documentation', '[role="main"]',
          'main', 'article', '.content', '#content', '.main-content', '#main-content',
          '.docs-content', '.docs-body', '.docs-markdown', 'body'
        ];
        
        let mainElement = null;
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            mainElement = elements[0];
            break;
          }
        }
        
        // Fallback to body
        mainElement = mainElement || document.body;
        
        // Get text content
        const mainContent = mainElement ? mainElement.textContent || '' : '';
        
        // Extract links
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(link => {
            const href = link.getAttribute('href');
            const text = link.textContent || '';
            
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || 
                href.startsWith('mailto:') || href.startsWith('tel:')) {
              return null;
            }
            
            return {
              url: href,
              text: text.trim() || href
            };
          })
          .filter(Boolean);
        
        return {
          mainContent: mainContent.trim(),
          links
        };
      });
      
      // Clean content
      const mainContent = content.mainContent
        .replace(/\s+/g, ' ')
        .trim();
      
      // Truncate if too long
      const truncatedContent = mainContent.length > 10000 
        ? mainContent.substring(0, 10000) + '... (content truncated)'
        : mainContent;
      
      // Resolve and filter links
      const links = content.links
        .map((link: any) => {
          try {
            const fullUrl = new URL(link.url, url).href;
            return {
              url: fullUrl,
              text: link.text
            };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean)
        .filter((link: any) => {
          try {
            return new URL(link.url).hostname === new URL(url).hostname;
          } catch (e) {
            return false;
          }
        });
      
      // For depth=1, just return the main content
      if (maxDepth <= 1 || links.length === 0) {
        return {
          rootUrl: url,
          explorationDepth: maxDepth,
          pagesExplored: 1,
          content: [{
            url,
            content: truncatedContent,
            links: links.slice(0, 10) // Limit to top 10 links
          }]
        };
      }
      
      // For depth > 1, explore a few child links
      const childResults = [];
      const limit = Math.min(3, links.length); // Strict limit to avoid timeouts
      
      for (let i = 0; i < limit; i++) {
        const link = links[i];
        if (link && !this.visitedUrls.has(link.url)) {
          try {
            const childContent = await this.fetchSimpleContent(link.url);
            if (childContent) {
              childResults.push({
                url: link.url,
                content: childContent,
                links: [] // Don't include links for child pages
              });
              this.visitedUrls.add(link.url);
            }
          } catch (e) {
            // Ignore errors on child pages
          }
        }
      }
      
      return {
        rootUrl: url,
        explorationDepth: maxDepth,
        pagesExplored: 1 + childResults.length,
        content: [{
          url,
          content: truncatedContent,
          links: links.slice(0, 10)
        }, ...childResults]
      };
      
    } catch (error) {
      console.error('Puppeteer fetch error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
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
