import * as cheerio from 'cheerio';
import { shouldSkipLink } from '../utils/url.js';
import { cleanInline, cleanText } from './text-cleanup.js';

export function renderMarkdown($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): string {
  const blocks: string[] = [];

  root.contents().each((_, node) => {
    const rendered = renderNode($, node, 0).trim();
    if (rendered) {
      blocks.push(rendered);
    }
  });

  const markdown = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return markdown || cleanText(root.text());
}

function renderNode($: cheerio.CheerioAPI, node: any, listDepth: number): string {
  const item = $(node);
  const type = (node as { type?: string }).type;

  if (type === 'text') {
    return cleanInline(item.text());
  }

  if (type !== 'tag') {
    return '';
  }

  const tag = ((node as { tagName?: string }).tagName ?? '').toLowerCase();

  switch (tag) {
    case 'h1':
      return heading(item, 1);
    case 'h2':
      return heading(item, 2);
    case 'h3':
      return heading(item, 3);
    case 'h4':
      return heading(item, 4);
    case 'h5':
    case 'h6':
      return heading(item, 5);
    case 'p':
      return renderChildren($, item, listDepth).trim();
    case 'br':
      return '\n';
    case 'pre':
      return codeBlock(item.text());
    case 'code':
      return `\`${cleanInline(item.text())}\``;
    case 'ul':
      return renderList($, item, listDepth, false);
    case 'ol':
      return renderList($, item, listDepth, true);
    case 'li':
      return renderChildren($, item, listDepth).trim();
    case 'blockquote':
      return renderChildren($, item, listDepth)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'a': {
      const href = item.attr('href');
      const text = renderChildren($, item, listDepth).trim() || cleanInline(item.text());
      return href && !shouldSkipLink(href) ? `[${text}](${href})` : text;
    }
    case 'table':
      return renderTable($, item);
    case 'nav':
    case 'footer':
    case 'aside':
    case 'button':
      return '';
    default:
      return renderChildren($, item, listDepth).trim();
  }
}

function renderChildren(
  $: cheerio.CheerioAPI,
  item: cheerio.Cheerio<any>,
  listDepth: number
): string {
  const parts: string[] = [];
  item.contents().each((_, child) => {
    const rendered = renderNode($, child, listDepth);
    if (rendered) {
      parts.push(rendered);
    }
  });

  return parts.join(' ').replace(/[ \t]+\n/g, '\n').replace(/\s{2,}/g, ' ').trim();
}

function renderList(
  $: cheerio.CheerioAPI,
  item: cheerio.Cheerio<any>,
  listDepth: number,
  ordered: boolean
): string {
  const lines: string[] = [];
  const indent = '  '.repeat(listDepth);

  item.children('li').each((index, child) => {
    const marker = ordered ? `${index + 1}.` : '-';
    const rendered = renderChildren($, $(child), listDepth + 1)
      .split('\n')
      .map((line, lineIndex) => (lineIndex === 0 ? line : `${indent}  ${line}`))
      .join('\n');

    if (rendered) {
      lines.push(`${indent}${marker} ${rendered}`);
    }
  });

  return lines.join('\n');
}

function renderTable($: cheerio.CheerioAPI, item: cheerio.Cheerio<any>): string {
  const rows = item
    .find('tr')
    .toArray()
    .map((row) =>
      $(row)
        .find('th, td')
        .toArray()
        .map((cell) => cleanInline($(cell).text()))
    )
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) {
    return '';
  }

  const [header, ...body] = rows;
  const separator = header.map(() => '---');
  return [header, separator, ...body].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

function heading(item: cheerio.Cheerio<any>, level: number): string {
  const text = cleanInline(item.text());
  return text ? `${'#'.repeat(level)} ${text}` : '';
}

function codeBlock(text: string): string {
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned ? `\`\`\`\n${cleaned}\n\`\`\`` : '';
}
