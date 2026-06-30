import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { buildFetchDocContentInputSchema, FETCH_DOC_CONTENT_TOOL } from './config/tool-options.js';
import { DocsCrawler } from './crawler/docs-crawler.js';

export class DocsFetchServer {
  private readonly server: Server;
  private readonly crawler: DocsCrawler;

  constructor(crawler = new DocsCrawler()) {
    this.crawler = crawler;
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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    console.error('Documentation fetch MCP server running on stdio');
    await this.server.connect(transport);
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: FETCH_DOC_CONTENT_TOOL.name,
          description: FETCH_DOC_CONTENT_TOOL.description,
          inputSchema: buildFetchDocContentInputSchema(),
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'fetch_doc_content') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }

      try {
        const result = await this.crawler.crawl(request.params.arguments);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching content: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
}
