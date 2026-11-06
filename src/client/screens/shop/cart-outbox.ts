// What this phone sent to the Walmart cart and the server hasn't recorded yet. The link has
// already added those items, and the cart can't be read, so forgetting them means the next tap
// adds them twice. They're kept here (through a reload, since the app often gets closed on the
// way to Walmart) before the server is told, and the next link leaves them out until it knows.
// The count can only err towards too much if a reply is lost after the server saved it: a
// quantity raised later then goes unsent, which "Start over" fixes, and no cart gets doubled.
import type { ISODate } from '../../../domain/dates.ts';
import { unsentLines, type CartLine, type SentToCart } from '../../../domain/walmart.ts';

const KEY = 'cuisine.walmart.unrecorded';

export type Outbox = { shopDate: ISODate; items: SentToCart };

/** Only this trip's: a new trip starts with an empty cart. */
export function outboxFor(saved: Outbox | null, shopDate: ISODate): SentToCart {
  return saved?.shopDate === shopDate ? saved.items : {};
}

/** What the next tap may send: what the server says is unsent, less what it hasn't heard about. */
export function linesToSend(toSend: readonly CartLine[], unrecorded: SentToCart): CartLine[] {
  return unsentLines(toSend, unrecorded);
}

export function outboxLines(unrecorded: SentToCart): CartLine[] {
  return Object.entries(unrecorded).map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** What's left after the server recorded `batch`, keeping anything sent meanwhile. */
export function afterRecording(unrecorded: SentToCart, batch: SentToCart): SentToCart {
  const left: SentToCart = {};
  for (const [itemId, quantity] of Object.entries(unrecorded)) {
    const rest = quantity - (batch[itemId] ?? 0);
    if (rest > 0) left[itemId] = rest;
  }
  return left;
}

export const savedOutbox = {
  load(): Outbox | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Outbox | null; } catch { return null; }
  },
  save(shopDate: ISODate, items: SentToCart) {
    if (Object.keys(items).length) localStorage.setItem(KEY, JSON.stringify({ shopDate, items } satisfies Outbox));
    else localStorage.removeItem(KEY);
  },
};
