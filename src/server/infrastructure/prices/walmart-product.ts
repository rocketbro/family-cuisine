// A Walmart product's name, read from its public page, one product at a time and once per product,
// to learn what size it comes in. Off unless WALMART_PRODUCT_LOOKUP is on; see "Aldi and Walmart
// lookups" in the README. Not authorized by Walmart, and it sends a browser's user agent rather than
// saying what it is. Personal use only: not for a hosted or commercial product.
import type { WalmartProductPort } from '../../application/ports/prices.ts';
import { BROWSER_USER_AGENT } from './browser-user-agent.ts';

const TITLE = /<title[^>]*>([^<]*?)\s*-\s*Walmart\.com\s*<\/title>/i;

export function walmartProductPage(): WalmartProductPort {
  return {
    async productName(itemId) {
      const response = await fetch(
        `https://www.walmart.com/ip/${itemId}`,
        { headers: { 'User-Agent': BROWSER_USER_AGENT, 'Accept-Language': 'en-US' }, signal: AbortSignal.timeout(15_000) },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Walmart answered ${response.status} for item ${itemId}`);
      const name = (await response.text()).match(TITLE)?.[1];
      if (!name) throw new Error(`No product name on Walmart's page for item ${itemId}`);
      return name.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'");
    },
  };
}
