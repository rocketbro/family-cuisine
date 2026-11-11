// A shopping trip on the record: the list you went in with, the receipts you came back with,
// and the difference between them.
import type { ISODate } from './dates.ts';
import { nameKey, type PantryItem, type Store } from './pantry.ts';
import { restocked, type PortionChange, type Storage } from './portions.ts';
import type { ShoppingReason } from './shopping.ts';
import { convert, parseUnit, type Unit } from './units.ts';

export type ReceiptStore = Store | 'other';
export type ReceiptStatus = 'reading' | 'failed' | 'ready' | 'applied';

/** One product off a receipt, as read and matched. Prices are only ever what was printed. */
export type ReceiptLine = {
  printed: string;
  name: string;
  pantryItemId: number | null;
  category: string;
  quantity: number;
  /** Individual pieces, for items counted in the pantry (18 for a carton of 18 eggs). */
  pieces: number | null;
  /** Set only for a way of keeping it that the pantry tracks in portions. */
  form: Extract<Storage, 'fresh' | 'canned' | 'dried'> | null;
  canOz: number | null;
  weightLb: number | null;
  lastsDays: number | null;
  cents: number | null;
  /** The match is a best guess, so it needs a person's eye. */
  unsure: boolean;
  /** The key of the list line this was bought instead of, so that line counts as bought. */
  insteadOf?: string | null;
};

/** A line of the list as it stood going into the store. */
export type TripLine = {
  key: string;
  name: string;
  pantryItemId: number | null;
  store: Store;
  reason: ShoppingReason;
  neededFor: string[];
  /** How many a counted line wanted. Lists saved before this have none. */
  quantity?: number | null;
  /** Checked off in the app, which already added this many to a counted item. */
  checkedOff: boolean;
  /** Back to 0 once a receipt has credited it, so a second receipt or line doesn't take it off again. */
  addedCount: number;
  /** A counted item's count just after it was checked off, to tell the same request from buying more. */
  countAfter?: number;
};

/** A counted line with no number to buy (a plain restock, say) counts as a dozen when it's checked off. */
export const COUNT_ASSUMED_BOUGHT = 12;

export type Receipt = {
  id: number;
  shopDate: ISODate;
  store: ReceiptStore;
  purchasedOn: ISODate | null;
  totalCents: number | null;
  status: ReceiptStatus;
  error: string | null;
  lines: ReceiptLine[];
};

export type TripDiff = {
  bought: { line: TripLine; matched: ReceiptLine[] }[];
  /** On the list for a store they shopped at, and not on its receipt. */
  skipped: TripLine[];
  /** On the receipt, and never on the list. */
  extras: ReceiptLine[];
};

const same = (line: TripLine, bought: ReceiptLine) =>
  bought.insteadOf === line.key || (line.pantryItemId !== null && bought.pantryItemId !== null
    ? line.pantryItemId === bought.pantryItemId
    : nameKey(line.name).join(' ') === nameKey(bought.name).join(' '));

/** Whether a line off a receipt is one the list had, itself or as what stood in for it. */
export function onTripList(list: readonly TripLine[], bought: ReceiptLine): boolean {
  return list.some(line => same(line, bought));
}

export function tripDiff(list: readonly TripLine[], receipts: readonly Pick<Receipt, 'store' | 'lines'>[]): TripDiff {
  const stores = new Set<string>(receipts.map(r => r.store));
  const lines = receipts.flatMap(r => r.lines);
  const bought: TripDiff['bought'] = [];
  const skipped: TripLine[] = [];
  for (const line of list) {
    const matched = lines.filter(l => same(line, l));
    if (matched.length) bought.push({ line, matched });
    else if (stores.has(line.store)) skipped.push(line);
  }
  return { bought, skipped, extras: lines.filter(l => !onTripList(list, l)) };
}

/** Today's list on top of what was saved: things checked off stay, even though they've left the list. */
export function mergeTripList(saved: readonly TripLine[], current: readonly TripLine[]): TripLine[] {
  const fresh = current.map(line => {
    const before = saved.find(s => s.key === line.key);
    return before?.checkedOff ? { ...line, checkedOff: true, addedCount: before.addedCount, countAfter: before.countAfter } : line;
  });
  return [...fresh, ...saved.filter(s => s.checkedOff && !current.some(c => c.key === s.key))];
}

/** The saved line a checked-off line refers to. */
export function isSameTripLine(saved: Pick<TripLine, 'pantryItemId' | 'name'>, line: { pantryItemId: number | null; name: string }): boolean {
  return line.pantryItemId !== null ? line.pantryItemId === saved.pantryItemId : line.name === saved.name;
}

/**
 * Checking a counted line off again with the count as the first time left it is the same request
 * repeated (a lost response, a second tap). Once the count has moved, it was used and bought again.
 */
export function repeatsCheckOff(saved: Pick<TripLine, 'checkedOff' | 'countAfter'> | undefined, count: number | null): boolean {
  return saved?.checkedOff === true && saved.countAfter !== undefined && saved.countAfter === count;
}

/** How much a checked-off count still needs crediting against a receipt, and the list once it's been credited. */
export function creditCheckOff(list: readonly TripLine[], pantryItemId: number): { added: number; list: TripLine[] } {
  const added = list.find(l => l.pantryItemId === pantryItemId && l.checkedOff)?.addedCount ?? 0;
  return { added, list: added ? list.map(l => (l.pantryItemId === pantryItemId && l.checkedOff ? { ...l, addedCount: 0 } : l)) : [...list] };
}

/** A check-off the saved list has no line for, so it still goes on the record. Keyed as the list keys it, so later saves merge with it. */
export function checkedOffLine(line: { name: string; pantryItemId: number | null }, store: Store): TripLine {
  const key = line.pantryItemId !== null ? `p${line.pantryItemId}` : `n:${line.name.toLowerCase()}`;
  return { key, name: line.name, pantryItemId: line.pantryItemId, store, reason: 'needed', neededFor: [], checkedOff: false, addedCount: 0 };
}

/** The part of a line that's left after some of its packages are accounted for elsewhere. */
export function remainderOfLine(line: ReceiptLine, packages: number): ReceiptLine {
  if (packages >= line.quantity) return line;
  const share = packages / line.quantity;
  return { ...line, quantity: packages, pieces: line.pieces && line.pieces * share, weightLb: line.weightLb && line.weightLb * share };
}

/** What buying this does to an item. `alreadyAdded` is what checking it off in the app counted. */
export function afterBuying(item: PantryItem, line: ReceiptLine, alreadyAdded = 0): { count?: number; portions?: PortionChange[] } {
  if (item.count !== null) return { count: Math.max(0, item.count - alreadyAdded) + (line.pieces ?? line.quantity) };
  const held = (storage: Storage) => item.portions.find(p => p.storage === storage);
  const form = line.form ?? (held('canned') && !held('fresh') ? 'canned' : held('dried') && !held('fresh') && line.weightLb ? 'dried' : held('fresh') && line.weightLb ? 'fresh' : null);
  if (form === 'canned') {
    const can = held('canned');
    return { portions: [{ storage: 'canned', amount: (can?.unit === 'can' ? can.amount ?? 0 : 0) + line.quantity, unit: 'can', canOz: line.canOz ?? can?.canOz ?? null }] };
  }
  if (form && line.weightLb) {
    const portion = held(form);
    const unit: Unit = portion?.unit && parseUnit(portion.unit) && ['oz', 'lb', 'g', 'kg'].includes(portion.unit) ? portion.unit : 'lb';
    return { portions: [{ storage: form, amount: Math.round(((portion?.unit === unit ? portion.amount ?? 0 : 0) + convert(line.weightLb, 'lb', unit)) * 100) / 100, unit }] };
  }
  if (form) return { portions: [{ storage: form, amount: null, unit: form === 'dried' ? 'lb' : null }] };
  return item.portions.length ? { portions: [restocked(item.portions)] } : {};
}
