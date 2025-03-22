import { Page } from 'puppeteer';
import { CONTENT_SELECTORS } from '../types/index.js';
import { ExtractedContent } from '../types/index.js';

/**
 * Extracts and processes content from web pages
 */
export class ContentExtractor {
  /**
   * Wait for content to be available on the page
   */
  async waitForContent(page: Page): Promise<void> {
    await page.waitForFunction(() => {
      return document.body && document.body.textContent && document.body.textContent.length > 0;
    });
  }

  /**
   * Check if page has meaningful content
   */
  async hasContent(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      return Boolean(document.body && document.body.textContent && document.body.textContent.trim().length > 100);
    });
  }

  /**
   * Extract the main content and links from a page
   */
  async extractContent(page: Page): Promise<ExtractedContent> {
    const content = await page.evaluate((selectors) => {
      // Helper function to clean text inside the evaluate context
      function cleanText(text: string): string {
        return text
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();
      }
      
      // Try all selectors until we find content
      let mainElement = null;
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          // If multiple elements match, find the one with the most text
          mainElement = elements.reduce((longest, current) => {
            return (current.textContent?.length || 0) > (longest.textContent?.length || 0) ? current : longest;
          }, elements[0]);
          
          if (mainElement.textContent && mainElement.textContent.trim().length > 200) {
            break;
          }
        }
      }

      // Fallback to body if no content found
      mainElement = mainElement || document.body;

      // Extract the main content text
      const mainContent = mainElement ? cleanText(mainElement.textContent || '') : '';

      // Extract links with relevance score
      const relatedLinks = Array.from(document.querySelectorAll('a[href]'))
        .map(link => {
          const href = link.getAttribute('href');
          const text = link.textContent || '';
          
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || 
              href.startsWith('mailto:') || href.startsWith('tel:')) {
            return null;
          }
          
          // Calculate relevance score based on various factors
          let relevance = 0;
          
          // Text length (longer text = more informative)
          relevance += Math.min(text.length / 10, 5);
          
          // Link appears in the main content area
          if (mainElement?.contains(link)) {
            relevance += 5;
          }
          
          // Link text hints at being informative content
          const informativeWords = ['guide', 'docs', 'tutorial', 'reference', 'example', 'api', 'learn', 'how to'];
          for (const word of informativeWords) {
            if (text.toLowerCase().includes(word)) {
              relevance += 2;
            }
          }
          
          return {
            url: href,
            text: text.trim(),
            relevance
          };
        })
        .filter(Boolean); // Remove null entries

      return {
        mainContent,
        relatedLinks
      };
    }, CONTENT_SELECTORS);

    return content as ExtractedContent;
  }

  /**
   * Clean text by removing excessive whitespace
   * @private
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}
