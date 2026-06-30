import { RenderMode } from '../types/index.js';

export const RENDER_MODES = ['auto', 'always', 'never'] as const satisfies readonly RenderMode[];

export const FETCH_DOC_CONTENT_TOOL = {
  name: 'fetch_doc_content',
  description: 'Fetch documentation content from a URL and optionally crawl same-origin links with bounded depth.',
} as const;

export const FETCH_DOC_CONTENT_OPTIONS = {
  depth: {
    description: 'Crawl depth where 1 fetches only the root page, 2 includes direct child links, and so on.',
    minimum: 1,
    maximum: 5,
    default: 1,
  },
  maxPages: {
    description: 'Maximum number of pages to return across the crawl.',
    minimum: 1,
    maximum: 50,
    default: 10,
  },
  maxConcurrency: {
    description: 'Maximum number of pages to fetch at once.',
    minimum: 1,
    maximum: 8,
    default: 3,
  },
  timeoutMs: {
    description: 'Global crawl timeout in milliseconds.',
    minimum: 5_000,
    maximum: 120_000,
    default: 45_000,
  },
  perPageTimeoutMs: {
    description: 'Per-page fetch timeout in milliseconds.',
    minimum: 1_000,
    maximum: 60_000,
    default: 10_000,
  },
  render: {
    description: 'Whether to use a browser renderer. auto tries HTTP first and renders thin or failed pages.',
    enum: RENDER_MODES,
    default: 'auto' satisfies RenderMode,
  },
  sameOrigin: {
    description: 'Restrict crawled links to the same URL origin.',
    default: true,
  },
  pathPrefix: {
    description: 'Optional path prefix for crawl scope, such as /docs. Links outside this prefix are not crawled.',
  },
  contentLimit: {
    description: 'Maximum Markdown characters returned per page before truncation.',
    minimum: 1_000,
    maximum: 50_000,
    default: 12_000,
  },
  includeLinks: {
    description: 'Include ranked links for each returned page.',
    default: true,
  },
} as const;

export function buildFetchDocContentInputSchema() {
  return {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'HTTP or HTTPS URL to fetch.',
      },
      depth: numberOptionSchema(FETCH_DOC_CONTENT_OPTIONS.depth),
      maxPages: numberOptionSchema(FETCH_DOC_CONTENT_OPTIONS.maxPages),
      maxConcurrency: numberOptionSchema(FETCH_DOC_CONTENT_OPTIONS.maxConcurrency),
      timeoutMs: numberOptionSchema(FETCH_DOC_CONTENT_OPTIONS.timeoutMs),
      perPageTimeoutMs: numberOptionSchema(FETCH_DOC_CONTENT_OPTIONS.perPageTimeoutMs),
      render: {
        type: 'string',
        enum: [...FETCH_DOC_CONTENT_OPTIONS.render.enum],
        description: FETCH_DOC_CONTENT_OPTIONS.render.description,
        default: FETCH_DOC_CONTENT_OPTIONS.render.default,
      },
      sameOrigin: {
        type: 'boolean',
        description: FETCH_DOC_CONTENT_OPTIONS.sameOrigin.description,
        default: FETCH_DOC_CONTENT_OPTIONS.sameOrigin.default,
      },
      pathPrefix: {
        type: 'string',
        description: FETCH_DOC_CONTENT_OPTIONS.pathPrefix.description,
      },
      contentLimit: numberOptionSchema(FETCH_DOC_CONTENT_OPTIONS.contentLimit),
      includeLinks: {
        type: 'boolean',
        description: FETCH_DOC_CONTENT_OPTIONS.includeLinks.description,
        default: FETCH_DOC_CONTENT_OPTIONS.includeLinks.default,
      },
    },
    required: ['url'],
  } as const;
}

function numberOptionSchema(option: {
  description: string;
  minimum: number;
  maximum: number;
  default: number;
}) {
  return {
    type: 'number',
    description: option.description,
    minimum: option.minimum,
    maximum: option.maximum,
    default: option.default,
  };
}
