import * as cheerio from 'cheerio';
import { CONTENT_SELECTORS } from '../config/content.js';
import { cleanText } from './text-cleanup.js';

export function selectMainElement($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  let best: cheerio.Cheerio<any> = $('body').first();
  let bestScore = textScore(best.text());

  for (const selector of CONTENT_SELECTORS) {
    const candidates = $(selector).toArray();
    for (const candidate of candidates) {
      const element: cheerio.Cheerio<any> = $(candidate);
      const score = textScore(element.text());
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }
  }

  return best;
}

function textScore(text: string): number {
  const cleaned = cleanText(text);
  return cleaned.length + (cleaned.match(/[.!?]\s/g)?.length ?? 0) * 20;
}
