// A link that opens Walmart with every item in the cart, in the person's own browser. It only fills
// the cart for review, never checks out. The format, /affil/cart/addToCart?items=ID|qty,ID|qty, works
// today but isn't documented by Walmart anywhere we could find; see the README.

export type CartLine = { itemId: string; quantity: number };

export function walmartCartUrl(lines: readonly CartLine[]): string | null {
  const items = lines
    .filter(line => line.quantity > 0 && /^\d+$/.test(line.itemId))
    .map(line => (line.quantity === 1 ? line.itemId : `${line.itemId}%7C${line.quantity}`));
  return items.length ? `https://www.walmart.com/affil/cart/addToCart?items=${items.join(',')}` : null;
}

/** How many of each product (by item ID) have already gone to the cart. */
export type SentToCart = Record<string, number>;

/** What the cart still needs: nothing already sent, and only the difference if the quantity went up. */
export function unsentLines(lines: readonly CartLine[], sent: SentToCart): CartLine[] {
  return lines
    .map(line => ({ itemId: line.itemId, quantity: line.quantity - (sent[line.itemId] ?? 0) }))
    .filter(line => line.quantity > 0);
}

/** Whether some of a line has gone to the cart, going by what's still to send. The app can't take it back out. */
export function alreadySent(line: { walmartItemId: string | null; packages: number }, toSend: readonly CartLine[]): boolean {
  if (!line.walmartItemId) return false;
  return (toSend.find(l => l.itemId === line.walmartItemId)?.quantity ?? 0) < line.packages;
}

export function addSent(sent: SentToCart, lines: readonly CartLine[]): SentToCart {
  const next = { ...sent };
  for (const line of lines) next[line.itemId] = (next[line.itemId] ?? 0) + line.quantity;
  return next;
}

export function walmartSearchUrl(query: string): string {
  return `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
}

export function walmartProductUrl(itemId: string): string {
  return `https://www.walmart.com/ip/${itemId}`;
}
