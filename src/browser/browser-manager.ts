import puppeteer, { Browser, PuppeteerLaunchOptions } from 'puppeteer';
import { DEFAULT_BROWSER_CONFIG } from '../types/index.js';

/**
 * Manages browser instances and operations
 */
export class BrowserManager {
  private browser: Browser | null = null;

  /**
   * Initialize a browser instance with default configuration
   */
  async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    const options: PuppeteerLaunchOptions = {
      headless: DEFAULT_BROWSER_CONFIG.headless ? 'new' : false,
      args: DEFAULT_BROWSER_CONFIG.args,
    };

    this.browser = await puppeteer.launch(options);
    return this.browser;
  }

  /**
   * Check if a URL is valid
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
