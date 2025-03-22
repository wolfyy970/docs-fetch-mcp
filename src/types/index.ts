// Types and interfaces for the docs-fetch-mcp server

// Content extraction interfaces
export interface ExtractedContent {
  mainContent: string;
  relatedLinks: Array<{
    url: string;
    text: string;
    relevance: number;
  }>;
}

// Browser configuration
export interface BrowserConfig {
  headless: boolean;
  args: string[];
}

export interface NavigationConfig {
  timeout: number;
  waitUntil: Array<'domcontentloaded' | 'networkidle0'>;
}

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
  timeout: 30000,
  waitUntil: ['domcontentloaded', 'networkidle0']
};

// Content extraction configuration
export const CONTENT_SELECTORS = [
  // Documentation specific selectors
  '.markdown-body',
  '.readme',
  '.documentation',
  '[role="main"]',
  // Common content selectors
  'main',
  'article',
  '.content',
  '#content',
  '.main-content',
  '#main-content',
  // Documentation selectors
  '.docs-content',
  '.docs-body',
  '.docs-markdown',
  // Fallback to body if no other content found
  'body'
];

export const BLOCKED_RESOURCE_TYPES = ['image', 'stylesheet', 'font', 'media'] as const;
