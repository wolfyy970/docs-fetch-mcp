import * as cheerio from 'cheerio';
import { CrawlLink } from '../types/index.js';
import { normalizeUrl, sameOrigin, shouldSkipLink } from '../utils/url.js';
import { cleanText } from './text-cleanup.js';

export function extractLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  main: cheerio.Cheerio<any>
): CrawlLink[] {
  const seen = new Map<string, CrawlLink>();
  const mainNode = main.get(0);

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || shouldSkipLink(href)) {
      return;
    }

    const url = normalizeUrl(href, baseUrl);
    if (!url) {
      return;
    }

    const text = cleanText($(element).text()) || url;
    const existing = seen.get(url);
    const score = scoreLink(url, text, Boolean(mainNode && $.contains(mainNode, element)));
    const link = {
      url,
      text,
      score,
      internal: sameOrigin(url, baseUrl),
    };

    if (!existing || link.score > existing.score) {
      seen.set(url, link);
    }
  });

  return Array.from(seen.values()).sort((left, right) => right.score - left.score);
}

function scoreLink(url: string, text: string, inMainContent: boolean): number {
  const lowerText = text.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const positiveWords = ['docs', 'guide', 'tutorial', 'reference', 'api', 'example', 'learn', 'quickstart'];
  const negativeWords = ['login', 'sign in', 'signup', 'pricing', 'privacy', 'terms', 'twitter', 'github'];

  let score = Math.min(text.length / 8, 8);
  if (inMainContent) {
    score += 8;
  }

  for (const word of positiveWords) {
    if (lowerText.includes(word) || lowerUrl.includes(word)) {
      score += 4;
    }
  }

  for (const word of negativeWords) {
    if (lowerText.includes(word) || lowerUrl.includes(word)) {
      score -= 6;
    }
  }

  return score;
}
