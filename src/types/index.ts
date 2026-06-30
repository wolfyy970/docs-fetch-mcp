export type RenderMode = 'auto' | 'always' | 'never';

export interface FetchDocContentArgs {
  url: string;
  depth?: number;
  maxPages?: number;
  maxConcurrency?: number;
  timeoutMs?: number;
  perPageTimeoutMs?: number;
  render?: RenderMode;
  sameOrigin?: boolean;
  pathPrefix?: string;
  contentLimit?: number;
  includeLinks?: boolean;
}

export interface NormalizedCrawlOptions {
  rootUrl: string;
  maxDepth: number;
  maxPages: number;
  maxConcurrency: number;
  timeoutMs: number;
  perPageTimeoutMs: number;
  render: RenderMode;
  sameOrigin: boolean;
  pathPrefix?: string;
  contentLimit: number;
  includeLinks: boolean;
}

export interface CrawlLink {
  url: string;
  text: string;
  score: number;
  internal: boolean;
}

export interface ExtractedPage {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  description?: string;
  canonicalUrl?: string;
  headings: string[];
  content: string;
  contentLength: number;
  truncated: boolean;
  links: CrawlLink[];
  fetchedWith: 'http' | 'browser';
}

export interface CrawlPage extends ExtractedPage {
  depth: number;
  parentUrl?: string;
}

export interface CrawlPageError {
  url: string;
  depth: number;
  parentUrl?: string;
  error: string;
  status?: number;
}

export interface CrawlResult {
  rootUrl: string;
  normalizedRootUrl: string;
  explorationDepth: number;
  maxPages: number;
  pagesExplored: number;
  pagesFailed: number;
  timedOut: boolean;
  durationMs: number;
  crawl: {
    sameOrigin: boolean;
    pathPrefix?: string;
    maxConcurrency: number;
    render: RenderMode;
    perPageTimeoutMs: number;
  };
  content: CrawlPage[];
  errors: CrawlPageError[];
}

export interface BrowserConfig {
  headless: boolean;
  args: string[];
}
