import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BrowserManager } from '../browser/browser-manager.js';
import { ContentExtractor } from '../content/content-extractor.js';
import { ExtractedPage, NormalizedCrawlOptions } from '../types/index.js';
import { normalizeUrl } from '../utils/url.js';

export interface PageFetcher {
  fetchPage(url: string, options: NormalizedCrawlOptions, startedAt: number): Promise<ExtractedPage>;
  close(): Promise<void>;
}

interface BrowserRenderer {
  renderHtml(url: string, timeoutMs: number): Promise<{ html: string; finalUrl: string; status: number }>;
  close(): Promise<void>;
}

interface HttpClient {
  get<T = unknown>(url: string, config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

export class DefaultPageFetcher implements PageFetcher {
  constructor(
    private readonly browserManager: BrowserRenderer = new BrowserManager(),
    private readonly extractor = new ContentExtractor(),
    private readonly httpClient: HttpClient = axios
  ) {}

  async fetchPage(url: string, options: NormalizedCrawlOptions, startedAt: number): Promise<ExtractedPage> {
    const remainingMs = Math.max(1, options.timeoutMs - (Date.now() - startedAt));
    const timeoutMs = Math.min(options.perPageTimeoutMs, remainingMs);

    if (options.render === 'always') {
      return this.fetchWithBrowser(url, options, timeoutMs);
    }

    try {
      const response = await this.httpClient.get<string>(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        responseType: 'text',
        headers: {
          Accept: 'text/html,text/plain;q=0.9,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (compatible; docs-fetch-mcp/1.0; +https://github.com/wolfyy970/docs-fetch-mcp)',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const finalUrl = normalizeUrl(response.request?.res?.responseUrl ?? url, url) ?? url;
      const contentType = String(response.headers['content-type'] ?? '');
      const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');

      if (contentType.includes('text/html') || looksLikeHtml(body)) {
        const page = this.extractor.extractFromHtml(body, {
          sourceUrl: url,
          finalUrl,
          status: response.status,
          contentLimit: options.contentLimit,
          fetchedWith: 'http',
        });

        if (options.render === 'auto' && isThinPage(page.content)) {
          return this.fetchWithBrowser(url, options, timeoutMs);
        }

        return page;
      }

      return this.extractor.extractFromText(body, {
        sourceUrl: url,
        finalUrl,
        status: response.status,
        contentLimit: options.contentLimit,
        fetchedWith: 'http',
      });
    } catch (error) {
      if (options.render === 'auto') {
        return this.fetchWithBrowser(url, options, timeoutMs);
      }

      throw error;
    }
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }

  private async fetchWithBrowser(url: string, options: NormalizedCrawlOptions, timeoutMs: number) {
    const rendered = await this.browserManager.renderHtml(url, timeoutMs);
    return this.extractor.extractFromHtml(rendered.html, {
      sourceUrl: url,
      finalUrl: normalizeUrl(rendered.finalUrl, url) ?? rendered.finalUrl,
      status: rendered.status,
      contentLimit: options.contentLimit,
      fetchedWith: 'browser',
    });
  }
}

function looksLikeHtml(body: string): boolean {
  return /<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<article[\s>]/i.test(body);
}

function isThinPage(content: string): boolean {
  return content.replace(/\s+/g, ' ').trim().length < 300;
}
