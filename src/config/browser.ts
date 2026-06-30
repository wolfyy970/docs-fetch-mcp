import { BrowserConfig } from '../types/index.js';

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

export const BLOCKED_RESOURCE_TYPES = ['image', 'stylesheet', 'font', 'media'] as const;
