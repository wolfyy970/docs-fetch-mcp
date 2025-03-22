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

    try {
      console.error('Initializing browser...');
      
      // Check Puppeteer version and set appropriate headless option
      let puppeteerVersion;
      try {
        puppeteerVersion = require('puppeteer/package.json').version;
        console.error(`Puppeteer version: ${puppeteerVersion}`);
      } catch (e) {
        console.error('Could not determine Puppeteer version, using fallback options');
      }
      
      // Configure browser options
      const options: PuppeteerLaunchOptions = {
        args: [...DEFAULT_BROWSER_CONFIG.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      };
      
      // Handle headless mode based on Puppeteer version
      if (puppeteerVersion && parseInt(puppeteerVersion.split('.')[0]) >= 19) {
        // For Puppeteer v19+, use 'new' for headless mode
        options.headless = DEFAULT_BROWSER_CONFIG.headless ? 'new' : false;
      } else {
        // For older versions, use boolean
        options.headless = DEFAULT_BROWSER_CONFIG.headless;
      }
      
      console.error('Launching browser with options:', options);
      this.browser = await puppeteer.launch(options);
      console.error('Browser launched successfully');
      return this.browser;
    } catch (error) {
      console.error('Browser initialization error:', error);
      throw error;
    }
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
