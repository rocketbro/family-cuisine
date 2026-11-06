// What the importer takes from a page's HTML. Written as single passes rather than regexes over
// the whole document: these are pages from strangers, and a few megabytes of unclosed tags would
// hang the server on a backtracking pattern.
const HIDDEN = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header']);
const LINE_ENDS = new Set(['/p', '/div', '/li', '/h1', '/h2', '/h3', '/h4', '/h5', '/h6', '/tr', '/br']);
/** Longer than this isn't a real meta or script tag, and the patterns below needn't see it. */
const MAX_TAG = 4096;

/** Lowercases ASCII only, so positions still line up with the original text. */
const lower = (text: string) => text.replace(/[A-Z]+/g, match => match.toLowerCase());

function tagName(lowered: string, open: number): string {
  let end = open + 1;
  if (lowered[end] === '/') end += 1;
  while (end < lowered.length && /[a-z0-9]/.test(lowered[end])) end += 1;
  return lowered.slice(open + 1, end);
}

export function pageText(html: string): string {
  const lowered = lower(html);
  const pieces: string[] = [];
  let at = 0;
  while (at < html.length) {
    const open = lowered.indexOf('<', at);
    if (open < 0) {
      pieces.push(html.slice(at));
      break;
    }
    pieces.push(html.slice(at, open));
    const close = lowered.indexOf('>', open);
    if (close < 0) break;
    const name = tagName(lowered, open);
    if (HIDDEN.has(name)) {
      const end = lowered.indexOf(`</${name}`, close);
      const after = end < 0 ? -1 : lowered.indexOf('>', end);
      if (after < 0) break;
      pieces.push(' ');
      at = after + 1;
    } else {
      pieces.push(LINE_ENDS.has(name) ? '\n' : ' ');
      at = close + 1;
    }
  }
  return decode(pieces.join('')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** The contents of each JSON-LD script tag. */
export function jsonLdBlocks(html: string): string[] {
  const lowered = lower(html);
  const blocks: string[] = [];
  let at = 0;
  for (;;) {
    const open = lowered.indexOf('<script', at);
    const close = open < 0 ? -1 : lowered.indexOf('>', open);
    const end = close < 0 ? -1 : lowered.indexOf('</script', close);
    if (end < 0) return blocks;
    if (close - open < MAX_TAG && /type\s*=\s*["']?application\/ld\+json/.test(lowered.slice(open, close))) blocks.push(html.slice(close + 1, end));
    at = end + 8;
  }
}

export function ogSiteName(html: string): string | null {
  const lowered = lower(html);
  let at = 0;
  for (;;) {
    const open = lowered.indexOf('<meta', at);
    const close = open < 0 ? -1 : lowered.indexOf('>', open);
    if (close < 0) return null;
    at = close + 1;
    if (close - open >= MAX_TAG) continue;
    const tag = html.slice(open, close);
    if (!/property=["']og:site_name["']/i.test(tag)) continue;
    const content = /content=["']([^"']+)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)));
}
