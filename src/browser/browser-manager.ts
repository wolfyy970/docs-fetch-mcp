import puppeteer, { Browser } from 'puppeteer';
import { BLOCKED_RESOURCE_TYPES, DEFAULT_BROWSER_CONFIG } from '../config/browser.js';

export class BrowserManager {
  private browser: Browser | null = null;

  async renderHtml(url: string, timeoutMs: number): Promise<{ html: string; finalUrl: string; status: number }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setDefaultNavigationTimeout(timeoutMs);
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        if ((BLOCKED_RESOURCE_TYPES as readonly string[]).includes(request.resourceType())) {
          void request.abort();
          return;
        }

        void request.continue();
      });

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      await page.waitForFunction(
        () => Boolean(document.body && document.body.textContent && document.body.textContent.trim().length > 0),
        { timeout: Math.min(2500, timeoutMs) }
      ).catch(() => undefined);

      return {
        html: await page.content(),
        finalUrl: page.url(),
        status: response?.status() ?? 0,
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async close(): Promise<void> {
    if (!this.browser) {
      return;
    }

    await this.browser.close();
    this.browser = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    this.browser = await puppeteer.launch({
      headless: DEFAULT_BROWSER_CONFIG.headless ? 'new' : false,
      args: DEFAULT_BROWSER_CONFIG.args,
    });

    return this.browser;
  }
}
