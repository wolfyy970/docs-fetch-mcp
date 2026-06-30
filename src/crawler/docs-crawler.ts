import { FETCH_DOC_CONTENT_OPTIONS } from '../config/tool-options.js';
import {
  CrawlLink,
  CrawlPage,
  CrawlPageError,
  CrawlResult,
  NormalizedCrawlOptions,
} from '../types/index.js';
import { parseFetchDocContentArgs } from '../tool/fetch-doc-content-args.js';
import { isInPathPrefix, normalizeUrl, sameOrigin } from '../utils/url.js';
import { DefaultPageFetcher, PageFetcher } from './page-fetcher.js';

interface QueueItem {
  url: string;
  depth: number;
  parentUrl?: string;
}

interface FetchFailure {
  message: string;
  status?: number;
}

interface CrawlState {
  queue: QueueItem[];
  seen: Set<string>;
  pages: CrawlPage[];
  errors: CrawlPageError[];
}

type FetchQueueResult = { page: CrawlPage; discoveredLinks: CrawlLink[] } | { error: CrawlPageError };

export class DocsCrawler {
  constructor(private readonly pageFetcher: PageFetcher = new DefaultPageFetcher()) {}

  async crawl(args: unknown): Promise<CrawlResult> {
    const startedAt = Date.now();
    const parsedArgs = parseFetchDocContentArgs(args);
    const options = normalizeOptions(parsedArgs);
    const rootUrl = options.rootUrl;
    const state: CrawlState = {
      queue: [{ url: rootUrl, depth: 0 }],
      seen: new Set<string>([rootUrl]),
      pages: [],
      errors: [],
    };
    let timedOut = false;

    try {
      while (state.queue.length > 0 && state.pages.length < options.maxPages) {
        if (Date.now() - startedAt >= options.timeoutMs) {
          timedOut = true;
          break;
        }

        const batch = this.dequeueBatch(state, options);
        const results = await Promise.all(batch.map((item) => this.fetchQueueItem(item, options, startedAt)));
        results.forEach((result) => this.applyFetchResult(result, state, rootUrl, options));
      }
    } finally {
      await this.pageFetcher.close();
    }

    return {
      rootUrl: parsedArgs.url,
      normalizedRootUrl: rootUrl,
      explorationDepth: options.maxDepth,
      maxPages: options.maxPages,
      pagesExplored: state.pages.length,
      pagesFailed: state.errors.length,
      timedOut,
      durationMs: Date.now() - startedAt,
      crawl: {
        sameOrigin: options.sameOrigin,
        pathPrefix: options.pathPrefix,
        maxConcurrency: options.maxConcurrency,
        render: options.render,
        perPageTimeoutMs: options.perPageTimeoutMs,
      },
      content: state.pages,
      errors: state.errors,
    };
  }

  private dequeueBatch(state: CrawlState, options: NormalizedCrawlOptions): QueueItem[] {
    const remainingSlots = options.maxPages - state.pages.length;
    return state.queue.splice(0, options.maxConcurrency).slice(0, remainingSlots);
  }

  private applyFetchResult(
    result: FetchQueueResult,
    state: CrawlState,
    rootUrl: string,
    options: NormalizedCrawlOptions
  ): void {
    if ('error' in result) {
      state.errors.push(result.error);
      return;
    }

    state.pages.push(result.page);
    this.enqueueDiscoveredLinks(result, state, rootUrl, options);
  }

  private enqueueDiscoveredLinks(
    result: { page: CrawlPage; discoveredLinks: CrawlLink[] },
    state: CrawlState,
    rootUrl: string,
    options: NormalizedCrawlOptions
  ): void {
    if (result.page.depth >= options.maxDepth - 1) {
      return;
    }

    for (const link of result.discoveredLinks) {
      if (state.pages.length + state.queue.length >= options.maxPages) {
        break;
      }

      const normalized = normalizeUrl(link.url, result.page.finalUrl);
      if (!normalized || state.seen.has(normalized) || !isCrawlable(normalized, rootUrl, options)) {
        continue;
      }

      state.seen.add(normalized);
      state.queue.push({
        url: normalized,
        depth: result.page.depth + 1,
        parentUrl: result.page.finalUrl,
      });
    }
  }

  private async fetchQueueItem(
    item: QueueItem,
    options: NormalizedCrawlOptions,
    startedAt: number
  ): Promise<FetchQueueResult> {
    try {
      const page = await this.pageFetcher.fetchPage(item.url, options, startedAt);
      return {
        page: {
          ...page,
          depth: item.depth,
          parentUrl: item.parentUrl,
          links: options.includeLinks ? page.links : [],
        },
        discoveredLinks: page.links,
      };
    } catch (error) {
      const failure = toFetchFailure(error);
      return {
        error: {
          url: item.url,
          depth: item.depth,
          parentUrl: item.parentUrl,
          error: failure.message,
          status: failure.status,
        },
      };
    }
  }

}

export function normalizeOptions(args: unknown): NormalizedCrawlOptions {
  const parsedArgs = parseFetchDocContentArgs(args);

  const rootUrl = normalizeUrl(parsedArgs.url);
  if (!rootUrl) {
    throw new Error('url must be a valid http or https URL');
  }

  const render = parsedArgs.render ?? FETCH_DOC_CONTENT_OPTIONS.render.default;

  return {
    rootUrl,
    maxDepth: clampNumberOption(parsedArgs.depth, FETCH_DOC_CONTENT_OPTIONS.depth, 'depth'),
    maxPages: clampNumberOption(parsedArgs.maxPages, FETCH_DOC_CONTENT_OPTIONS.maxPages, 'maxPages'),
    maxConcurrency: clampNumberOption(
      parsedArgs.maxConcurrency,
      FETCH_DOC_CONTENT_OPTIONS.maxConcurrency,
      'maxConcurrency'
    ),
    timeoutMs: clampNumberOption(parsedArgs.timeoutMs, FETCH_DOC_CONTENT_OPTIONS.timeoutMs, 'timeoutMs'),
    perPageTimeoutMs: clampNumberOption(
      parsedArgs.perPageTimeoutMs,
      FETCH_DOC_CONTENT_OPTIONS.perPageTimeoutMs,
      'perPageTimeoutMs'
    ),
    render,
    sameOrigin: parsedArgs.sameOrigin ?? FETCH_DOC_CONTENT_OPTIONS.sameOrigin.default,
    pathPrefix: parsedArgs.pathPrefix,
    contentLimit: clampNumberOption(parsedArgs.contentLimit, FETCH_DOC_CONTENT_OPTIONS.contentLimit, 'contentLimit'),
    includeLinks: parsedArgs.includeLinks ?? FETCH_DOC_CONTENT_OPTIONS.includeLinks.default,
  };
}

function isCrawlable(url: string, rootUrl: string, options: NormalizedCrawlOptions): boolean {
  if (options.sameOrigin && !sameOrigin(url, rootUrl)) {
    return false;
  }

  return isInPathPrefix(url, rootUrl, options.pathPrefix);
}

function clampInteger(value: number, min: number, max: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampNumberOption(
  value: number | undefined,
  option: { default: number; minimum: number; maximum: number },
  name: string
): number {
  return clampInteger(value ?? option.default, option.minimum, option.maximum, name);
}

function toFetchFailure(error: unknown): FetchFailure {
  if (isErrorWithStatus(error)) {
    return {
      message: error.message,
      status: error.response?.status,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: String(error) };
}

function isErrorWithStatus(error: unknown): error is Error & { response?: { status?: number } } {
  return error instanceof Error && 'response' in error;
}
