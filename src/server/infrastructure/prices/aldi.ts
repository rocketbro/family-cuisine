// Aldi shelf prices by ZIP code, read from aldi.us the way its own search page does.
//
// Off unless ALDI_PRICE_LOOKUP is on; see "Aldi and Walmart lookups" in the README before using it.
// This is an undocumented API (Instacart's storefront behind aldi.us), not authorized by Aldi or
// Instacart, and it sends a browser's user agent rather than saying what it is. A handful of requests
// a week, cached. It will break when Instacart changes things; when it does, the list falls back to
// typed prices. Personal use only: not for a hosted or commercial product.
//
// The flow: a guest session (cookies from any store page), the persisted-query hashes from
// the site's own manifest, the in-store shop for the ZIP, then search → items → price.
import { bestProduct } from '../../../domain/product-match.ts';
import type { StorePricePort, StorePriceQuote } from '../../application/ports/prices.ts';
import { UserError } from '../../application/user-error.ts';
import { BROWSER_USER_AGENT } from './browser-user-agent.ts';

const SITE = 'https://www.aldi.us';
const SESSION_HOURS = 6;
const OPERATIONS = ['ShopCollectionScoped', 'SearchResultsPlacements', 'Items'] as const;
type Operation = (typeof OPERATIONS)[number];

type Session = { cookie: string; hashes: Record<Operation, string>; at: number };
type Shop = { shopId: string; zoneId: string };

export function aldiPrices(log: (message: string) => void): StorePricePort {
  let session: Session | null = null;
  const shops = new Map<string, Shop>();

  async function fetchText(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, { ...init, headers: { 'User-Agent': BROWSER_USER_AGENT, 'Accept-Language': 'en-US', ...init.headers }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new UserError(`Aldi answered ${response.status}. Try again later.`, 502);
    return response;
  }

  async function startSession(): Promise<Session> {
    const page = await fetchText(`${SITE}/store/aldi/s?k=milk`);
    const cookie = page.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const html = await page.text();
    const runtimeUrl = html.match(/https:\/\/[^"]+\/runtime\.webpack_bundle-[^"]+\.js/)?.[0];
    if (!runtimeUrl) throw new UserError('Aldi’s page changed: no runtime bundle found.', 502);
    const runtime = await (await fetchText(runtimeUrl)).text();
    // The runtime maps chunk ids to names and to content hashes; find the operation-hashes chunk.
    const chunkId = runtime.match(/(\d+):"operation-hashes"/)?.[1];
    const chunkHash = chunkId ? runtime.match(new RegExp(`${chunkId}:"([0-9a-f]{8,})"`, 'g'))?.map(m => m.split('"')[1]).find(h => h !== 'operation-hashes') : null;
    if (!chunkHash) throw new UserError('Aldi’s page changed: no query manifest found.', 502);
    const base = runtimeUrl.slice(0, runtimeUrl.lastIndexOf('/') + 1);
    const manifest = await (await fetchText(`${base}operation-hashes-${chunkHash}-v3.webpack_chunk.js`)).text();
    const hashes = {} as Record<Operation, string>;
    for (const op of OPERATIONS) {
      const hash = manifest.match(new RegExp(`"${op}":"([0-9a-f]{64})"`))?.[1];
      if (!hash) throw new UserError(`Aldi’s page changed: no ${op} query.`, 502);
      hashes[op] = hash;
    }
    return { cookie, hashes, at: Date.now() };
  }

  async function query<T>(op: Operation, variables: object, retried = false): Promise<T> {
    if (!session || Date.now() - session.at > SESSION_HOURS * 3600_000) session = await startSession();
    const params = new URLSearchParams({
      operationName: op,
      variables: JSON.stringify(variables),
      extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: session.hashes[op] } }),
    });
    const body = await (await fetchText(
      `${SITE}/graphql?${params}`, { headers: { Cookie: session.cookie, Accept: 'application/json' } },
    )).json() as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length && !body.data) {
      // A redeploy changes the hashes, and sessions expire: start over once.
      if (!retried) { session = null; return query(op, variables, true); }
      throw new Error(`Aldi: ${body.errors[0].message}`);
    }
    return body.data as T;
  }

  async function shopFor(zip: string, coordinates: { latitude: number; longitude: number }): Promise<Shop> {
    const known = shops.get(zip);
    if (known) return known;
    const data = await query<{ shopCollection: { shops: { id: string; serviceType: string }[] } }>('ShopCollectionScoped', {
      addressId: null, allowCanonicalFallback: true, coordinates, postalCode: zip, retailerSlug: 'aldi',
    });
    const list = data.shopCollection.shops;
    // In-store prices are the shelf prices; delivery and pickup carry Instacart's markup.
    const shop = list.find(s => s.serviceType === 'instore') ?? list.find(s => s.serviceType === 'pickup') ?? list[0];
    if (!shop) throw new UserError(`No Aldi near ${zip}.`, 404);
    const found = { shopId: shop.id, zoneId: '1' };
    shops.set(zip, found);
    return found;
  }

  async function quote(name: string, zip: string, shop: Shop): Promise<StorePriceQuote | null> {
    const common = { shopId: shop.shopId, postalCode: zip, zoneId: shop.zoneId };
    const search = await query<{ searchResultsPlacements: { placements: { content: { __typename: string; itemIds?: string[] } }[] } }>(
      'SearchResultsPlacements', { ...common, query: name, first: 10, pageViewId: crypto.randomUUID() },
    );
    const ids = search.searchResultsPlacements.placements.find(p => p.content.__typename === 'SearchContentManagementSearchItemGrid')?.content.itemIds?.slice(0, 10) ?? [];
    if (!ids.length) return null;
    const { items } = await query<{ items: AldiItem[] }>('Items', { ...common, ids });
    const priced = items.flatMap(item => {
      const cents = dollarsToCents(item.price?.viewSection?.itemCard?.priceString);
      if (cents === null || item.availability?.available === false) return [];
      // Sold by weight, the price is Aldi's estimate for one "About 1.85 lb / package", so keep that size.
      const weight = item.price?.viewSection?.itemCard?.pricingUnitSecondaryString?.match(/about [\d.]+ lb.*/i)?.[0].toLowerCase();
      const name = item.name.replace(/,?\s*per lb$/i, '');
      const size = item.size && item.size !== 'per lb' && !name.toLowerCase().includes(item.size.toLowerCase()) ? item.size : null;
      return [{ name: [name, weight ?? size].filter(Boolean).join(', '), cents }];
    });
    const best = bestProduct(name, priced);
    return best ? { cents: best.cents, product: best.name } : null;
  }

  return {
    async lookup(names, location) {
      const shop = await shopFor(location.zip, { latitude: location.latitude, longitude: location.longitude });
      const out = new Map<string, StorePriceQuote>();
      for (const name of names) {
        try {
          const found = await quote(name, location.zip, shop);
          if (found) out.set(name, found);
        } catch (e) {
          log(`aldi price for "${name}" failed: ${(e as Error).message}`);
          if (out.size === 0) throw e;
        }
        await new Promise(r => setTimeout(r, 400)); // keep it gentle
      }
      return out;
    },
  };
}

type AldiItem = {
  name: string;
  size?: string;
  availability?: { available?: boolean };
  price?: { viewSection?: { itemCard?: { priceString?: string; pricingUnitSecondaryString?: string } } };
};

function dollarsToCents(text: string | undefined): number | null {
  const match = text?.match(/\$(\d+(?:\.\d{1,2})?)/);
  return match ? Math.round(Number(match[1]) * 100) : null;
}
