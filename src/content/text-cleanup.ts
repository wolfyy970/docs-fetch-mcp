export function cleanText(text: string): string {
  return compactWhitespace(text);
}

export function cleanInline(text: string): string {
  return compactWhitespace(text);
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
