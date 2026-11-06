import { formatDollars } from '../../../domain/prices.ts';
import type { ReceiptLine, ReceiptStore } from '../../../domain/receipts.ts';

export const STORE_NAME: Record<ReceiptStore, string> = { aldi: 'Aldi', walmart: 'Walmart', other: 'Receipt' };

export { formatDollars as dollars } from '../../../domain/prices.ts';

/** What the receipt said about a line. */
export function lineDetail(line: ReceiptLine): string {
  return [
    line.printed, line.quantity > 1 ? `×${line.quantity}` : null, line.weightLb ? `${line.weightLb} lb` : null,
    line.cents !== null ? formatDollars(line.cents) : null,
  ].filter(Boolean).join(' · ');
}
