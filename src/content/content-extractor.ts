import * as cheerio from 'cheerio';
import { ExtractedPage } from '../types/index.js';
import { normalizeUrl } from '../utils/url.js';
import { extractLinks } from './link-extractor.js';
import { selectMainElement } from './main-content-selector.js';
import { renderMarkdown } from './markdown-renderer.js';
import { cleanText } from './text-cleanup.js';

interface ExtractContentOptions {
  sourceUrl: string;
  finalUrl?: string;
  status: number;
  contentLimit: number;
  fetchedWith: 'http' | 'browser';
}

export class ContentExtractor {
  extractFromHtml(html: string, options: ExtractContentOptions): ExtractedPage {
    const $ = cheerio.load(html);
    const finalUrl = options.finalUrl ?? options.sourceUrl;

    $('script, style, noscript, svg, canvas, iframe, form').remove();

    const title = cleanText($('title').first().text()) || cleanText($('h1').first().text());
    const description = cleanText($('meta[name="description"]').attr('content') ?? '');
    const canonicalHref = $('link[rel="canonical"]').attr('href');
    const canonicalUrl = canonicalHref ? normalizeUrl(canonicalHref, finalUrl) ?? undefined : undefined;

    const main = selectMainElement($);
    const headings = main
      .find('h1, h2, h3')
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter(Boolean)
      .slice(0, 30);

    const markdown = renderMarkdown($, main);
    const contentLength = markdown.length;
    const truncated = contentLength > options.contentLimit;
    const content = truncated
      ? `${markdown.slice(0, options.contentLimit).trim()}\n\n... (content truncated)`
      : markdown;

    return {
      url: options.sourceUrl,
      finalUrl,
      status: options.status,
      title: title || finalUrl,
      description: description || undefined,
      canonicalUrl,
      headings,
      content,
      contentLength,
      truncated,
      links: extractLinks($, finalUrl, main),
      fetchedWith: options.fetchedWith,
    };
  }

  extractFromText(text: string, options: ExtractContentOptions): ExtractedPage {
    const cleaned = cleanText(text);
    const truncated = cleaned.length > options.contentLimit;
    const content = truncated
      ? `${cleaned.slice(0, options.contentLimit).trim()}\n\n... (content truncated)`
      : cleaned;

    return {
      url: options.sourceUrl,
      finalUrl: options.finalUrl ?? options.sourceUrl,
      status: options.status,
      title: options.finalUrl ?? options.sourceUrl,
      headings: [],
      content,
      contentLength: cleaned.length,
      truncated,
      links: [],
      fetchedWith: options.fetchedWith,
    };
  }
}
