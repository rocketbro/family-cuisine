// Asks Anthropic's web fetch tool for a page, when a site has turned our own fetch away and the
// person said to try. It only fetches: the recipe is read afterwards by `recipeFromPage`, like any
// other page, in a request with no tools. This one can reach only the site it was given, once,
// and holds nothing private (not even the family's rules). It runs on the fast model, which takes web_fetch_20250910. What it fetched is a stranger's text and may be written to steer it.
import Anthropic from '@anthropic-ai/sdk';
import type { PageFetcherPort } from '../../application/ports/pages.ts';
import { UserError } from '../../application/user-error.ts';
import { readableApiError } from './errors.ts';

type Options = { apiKey: string | null; model: string };

const MAX_CONTENT_TOKENS = 30_000;
/** Less than this is an interstitial or an error page, not a recipe. */
const FEWEST_CHARS = 200;
const COULD_NOT_READ = 'Claude couldn’t read that page either.';

export function claudePageFetcher({ apiKey, model }: Options): PageFetcherPort {
  const client = apiKey ? new Anthropic({ apiKey }) : null;
  return {
    async fetch(url) {
      if (!client) throw new UserError('No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.', 503);
      const start = webLink(url);
      const site = start.hostname.replace(/^www\./, '');
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        output_config: { effort: 'low' },
        tools: [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 1, allowed_domains: [site], max_content_tokens: MAX_CONTENT_TOKENS }],
        messages: [{ role: 'user', content: `Fetch ${start.href} with web_fetch, then reply only "done".` }],
      }).catch(error => { throw readableApiError(error); });
      return { ...pageFromReply(response.content, start.href), siteName: site };
    },
  };
}

function webLink(url: string): URL {
  if (URL.canParse(url)) {
    const link = new URL(url);
    if (link.protocol === 'https:' || link.protocol === 'http:') return link;
  }
  throw new UserError('That doesn’t look like a web link.');
}

/** The fetched text, from a reply that holds it only if the fetch worked. */
export function pageFromReply(blocks: Anthropic.ContentBlock[], asked: string): { url: string; content: string } {
  for (const block of blocks) {
    if (block.type !== 'web_fetch_tool_result' || block.content.type !== 'web_fetch_result') continue;
    const { source } = block.content.content;
    if (source.type !== 'text' || source.data.trim().length < FEWEST_CHARS) break;
    return { url: block.content.url || asked, content: source.data };
  }
  throw new UserError(COULD_NOT_READ, 422);
}
