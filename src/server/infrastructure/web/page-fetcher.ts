// Fetches a recipe page for import. Most recipe sites publish schema.org Recipe data as
// JSON-LD, which is far cleaner than the page text; the text is the fallback. The page is
// untrusted and picked by whoever pasted the link: public addresses only, a bounded download,
// and a bounded amount handed on to the model.
import type { PageFetcherPort } from '../../application/ports/pages.ts';
import { UserError } from '../../application/user-error.ts';
import { jsonLdBlocks, ogSiteName, pageText } from './html-text.ts';
import { nodeTransport } from './node-transport.ts';
import { PRIVATE_LINK } from './public-address.ts';
import { fetchPublic, type WebTransport } from './public-fetch.ts';

const TIMEOUT_MS = 20_000;
/** A page cut off here is still parsed: the recipe is rarely at the very end. */
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_RECIPE_CHARS = 30_000;
const MAX_TEXT_BESIDE_RECIPE = 10_000;
const MAX_TEXT_ALONE = 60_000;
const REFUSALS = [401, 403, 429];

function unavailable(status: number): UserError {
  if (REFUSALS.includes(status)) return new UserError('This site blocked the import.', 422, 'site-refused');
  if (status === 404 || status === 410) return new UserError('That page isn’t there. Check the link and try again.', 422);
  return new UserError(`That site couldn’t give us the page (HTTP ${status}).`, 422);
}

function friendly(error: unknown): UserError {
  if (error instanceof UserError) return error;
  const { name, code } = error as { name?: string; code?: string };
  if (code === 'EPRIVATEADDRESS') return new UserError(PRIVATE_LINK, 422);
  if (name === 'TimeoutError' || name === 'AbortError') return new UserError('That page took too long to answer.', 422);
  return new UserError('Couldn’t reach that page. Check the link and try again.', 422);
}

export function webPageFetcher(transport: WebTransport = nodeTransport()): PageFetcherPort {
  return {
    async fetch(url) {
      let start: URL;
      try {
        start = new URL(url);
      } catch {
        throw new UserError('That doesn’t look like a web link.');
      }
      try {
        const { url: final, reply } = await fetchPublic(start, transport, AbortSignal.timeout(TIMEOUT_MS));
        if (reply.status < 200 || reply.status >= 300) {
          reply.discard();
          throw unavailable(reply.status);
        }
        const type = reply.header('content-type');
        if (type && !/text|html|xml|json/i.test(type)) {
          reply.discard();
          throw new UserError('That link isn’t a web page.', 422);
        }
        const html = (await reply.read(MAX_PAGE_BYTES)).toString('utf8');
        return { url: final.href, siteName: ogSiteName(html) ?? final.hostname.replace(/^www\./, ''), content: modelContent(html) };
      } catch (error) {
        throw friendly(error);
      }
    },
  };
}

export function modelContent(html: string): string {
  const recipe = jsonLdRecipe(html);
  if (!recipe) return pageText(html).slice(0, MAX_TEXT_ALONE);
  return `Structured recipe data:\n${recipe.slice(0, MAX_RECIPE_CHARS)}\n\nPage text:\n${pageText(html).slice(0, MAX_TEXT_BESIDE_RECIPE)}`;
}

function jsonLdRecipe(html: string): string | null {
  for (const block of jsonLdBlocks(html)) {
    try {
      const found = findRecipe(JSON.parse(block.trim()));
      if (found) return JSON.stringify(found);
    } catch {
      // Malformed JSON-LD is common; keep looking.
    }
  }
  return null;
}

function findRecipe(node: unknown): unknown {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipe(child);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return record;
  return findRecipe(record['@graph']);
}
