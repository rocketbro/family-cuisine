// Receipts: kept first, read in the background so a sleeping phone can't lose one, and only
// changing the pantry once someone has looked it over.
import { addDays, realDateOrNull, toISODate, type ISODate } from '../../domain/dates.ts';
import type { PantryItem, Store } from '../../domain/pantry.ts';
import {
  afterBuying, checkedOffLine, COUNT_ASSUMED_BOUGHT, creditCheckOff, isSameTripLine, mergeTripList, remainderOfLine,
  tripDiff, type ReceiptLine, type TripDiff, type TripLine,
} from '../../domain/receipts.ts';
import type { ShoppingLine } from '../../domain/shopping.ts';
import { tripSuggestions } from '../../domain/trip-learning.ts';
import type { ReceiptSummary, ReceiptView, TripsView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { addPantryItem, updatePantryItem } from './pantry.ts';
import { keepNeverAdds, leftOutLines } from './receipt-never-add.ts';
import { insteadOfLines, type Substitute } from './receipt-substitutes.ts';
import { standIn } from './stand-ins.ts';
import { storeFromReceipt } from './stock-up.ts';
import type { ReceiptRecord, ReceiptUpload } from './ports/receipts.ts';
import { UserError } from './user-error.ts';

/** A receipt belongs to the saved list nearest its date, within this many days. */
const TRIP_WINDOW_DAYS = 3;
/** Past this, a read that never finished died with a restart, so offer Retry. */
const READING_LIMIT_MS = 5 * 60 * 1000;
const DISMISSED = 'dismissed_trip_suggestions';

/** Saves the list as it stands, so there's something to compare a receipt with later. */
export function keepTripList(deps: Deps, shopDate: ISODate, lines: readonly ShoppingLine[]): void {
  const current: TripLine[] = lines.map(l => ({
    key: l.key, name: l.name, pantryItemId: l.pantryItemId, store: l.store, reason: l.reason, neededFor: l.neededFor, quantity: l.quantity,
    checkedOff: false, addedCount: 0,
  }));
  deps.receipts.saveTripList(shopDate, mergeTripList(deps.receipts.tripList(shopDate) ?? [], current));
}

/** Notes what's been checked off, so it stays on the record after it leaves the list. */
export function noteCheckedOff(
  deps: Deps, shopDate: ISODate, store: Store,
  lines: { name: string; pantryItemId: number | null; quantity: number | null; countAfter: number | null }[],
): void {
  if (!lines.length) return;
  const known = deps.receipts.tripList(shopDate) ?? [];
  // The list may not have the line (it recalculates, and the day may have turned over), and then nothing would remember this.
  const saved = [...known, ...lines.filter(l => !known.some(s => isSameTripLine(s, l))).map(l => checkedOffLine(l, store))];
  deps.receipts.saveTripList(shopDate, saved.map(line => {
    const done = lines.find(l => isSameTripLine(line, l));
    if (!done) return line;
    return { ...line, checkedOff: true, addedCount: done.countAfter !== null ? done.quantity ?? COUNT_ASSUMED_BOUGHT : 0, countAfter: done.countAfter ?? undefined };
  }));
}

export function addReceipt(deps: Deps, uploads: ReceiptUpload[], today: ISODate): number {
  if (!deps.ai.available()) throw new UserError('Reading receipts needs the Anthropic API key in .env.', 503);
  if (!uploads.length) throw new UserError('Add a photo, screenshot or PDF of the receipt.');
  const files = uploads.map(u => deps.receiptFiles.save(u.data));
  const id = deps.receipts.create(today, files);
  void readReceipt(deps, id, today);
  return id;
}

export function retryReceipt(deps: Deps, id: number, today: ISODate): void {
  const receipt = deps.receipts.get(id);
  if (!receipt || receipt.status === 'applied') throw new UserError('That receipt can’t be read again.', 409);
  deps.receipts.update(id, { status: 'reading', error: null, createdAt: new Date().toISOString() });
  void readReceipt(deps, id, today);
}

async function readReceipt(deps: Deps, id: number, today: ISODate): Promise<void> {
  try {
    const record = deps.receipts.get(id)!;
    const files = (await Promise.all(record.files.map(f => deps.receiptFiles.forModel(f)))).flat();
    const pantry = deps.pantry.list();
    const nearest = nearestTrip(deps, today);
    const expected = deps.receipts.tripList(nearest);
    const list = expected && { shopDate: nearest, lines: expected.map(l => ({ name: l.name, store: l.store })) };
    const read = await deps.ai.readReceipt(files, { today, list, pantry: pantry.map(p => ({ name: p.name, counted: p.count !== null, portions: p.portions.map(x => x.storage) })) });
    const purchasedOn = realDateOrNull(read.purchasedOn);
    const shopDate = nearestTrip(deps, purchasedOn ?? today);
    deps.receipts.update(id, {
      status: 'ready', error: null, store: read.store, purchasedOn, shopDate, totalCents: read.totalCents,
      lines: read.lines.map(({ pantryName, ...line }) => ({
        ...line, name: line.name.trim(), pantryItemId: pantry.find(p => p.name === pantryName)?.id ?? null,
        quantity: line.quantity > 0 ? line.quantity : 1,
      })),
    });
  } catch (e) {
    deps.log(`receipt ${id} couldn't be read: ${(e as Error).message}`);
    deps.receipts.update(id, { status: 'failed', error: e instanceof UserError ? e.message : 'Couldn’t read that receipt. It’s saved, so you can try again.' });
  }
}

function nearestTrip(deps: Deps, date: ISODate): ISODate {
  const within = (d: ISODate) => d >= addDays(date, -TRIP_WINDOW_DAYS) && d <= addDays(date, TRIP_WINDOW_DAYS);
  const gap = (d: ISODate) => Math.abs(new Date(d).getTime() - new Date(date).getTime());
  return deps.receipts.tripDates().filter(within).sort((a, b) => gap(a) - gap(b))[0] ?? date;
}

type Kept = { index: number; name: string }[];

/** Choices beyond what's kept: lines never to add again, and lines bought instead of something on the list. */
export type ReceiptDecisions = { neverAdd?: Kept; substitutes?: Substitute[] };

/** What a person decided for each line: their kept lines, under the name they chose. All of it lands with the move to applied, or none of it does. */
export function applyReceipt(deps: Deps, id: number, kept: Kept, decisions: ReceiptDecisions = {}): void {
  deps.unitOfWork.run(() => {
    const receipt = deps.receipts.get(id);
    if (!receipt || receipt.status !== 'ready') throw new UserError('That receipt has already been saved.', 409);
    const trip = { list: deps.receipts.tripList(receipt.shopDate) };
    keepNeverAdds(deps, receipt.lines, trip.list ?? [], decisions.neverAdd ?? [], kept);
    const instead = insteadOfLines(receiptOnTrip(deps, receipt).diff, decisions.substitutes ?? [], kept);
    const lines: ReceiptLine[] = [];
    const store = receipt.store === 'other' ? null : receipt.store;
    for (const { index, name } of kept) {
      const original = receipt.lines[index];
      if (!original) continue;
      const line = { ...original, name: name.trim() || original.name };
      const item = deps.pantry.findByName(line.name) ?? (line.name === original.name && original.pantryItemId !== null ? deps.pantry.get(original.pantryItemId) : null);
      const stored = stock(deps, item, line, trip, receipt.shopDate);
      const replaced = instead.get(index);
      lines.push({ ...line, pantryItemId: stored.id, ...(replaced ? { insteadOf: replaced.line.key } : {}) });
      rememberPrice(deps, store, stored.id, line);
      if (replaced && replaced.line.pantryItemId !== stored.id) standIn(deps, stored, replaced.line.name, replaced.always);
    }
    if (trip.list) deps.receipts.saveTripList(receipt.shopDate, trip.list);
    deps.receipts.update(id, { status: 'applied', lines });
  });
}

/** What was paid last time is the estimate for next time, unless someone typed their own. */
function rememberPrice(deps: Deps, store: Store | null, itemId: number, line: ReceiptLine): void {
  if (!store || line.cents === null || line.quantity <= 0 || deps.prices.forStore(store).get(itemId)?.source === 'typed') return;
  const each = line.weightLb ? `, about ${Math.round((line.weightLb / line.quantity) * 100) / 100} lb` : '';
  deps.prices.save(itemId, store, { cents: Math.round(line.cents / line.quantity), source: 'receipt', product: `${line.printed}${each}` });
}

/**
 * An old receipt can teach prices, but what it bought is long gone: the pantry and the week's list
 * stay as they are, it doesn't count as a trip, and the receipt isn't kept. Lines with no pantry item are skipped.
 */
export function savePricesOnly(deps: Deps, id: number, kept: Kept, decisions: ReceiptDecisions = {}): void {
  const files = deps.unitOfWork.run(() => {
    const receipt = deps.receipts.get(id);
    if (!receipt || receipt.status !== 'ready') throw new UserError('That receipt has already been saved.', 409);
    keepNeverAdds(deps, receipt.lines, deps.receipts.tripList(receipt.shopDate) ?? [], decisions.neverAdd ?? [], kept);
    const store = receipt.store === 'other' ? null : receipt.store;
    for (const { index, name } of kept) {
      const line = receipt.lines[index];
      if (!line) continue;
      const item = deps.pantry.findByName(name.trim() || line.name) ?? (line.pantryItemId !== null ? deps.pantry.get(line.pantryItemId) : null);
      if (item) rememberPrice(deps, store, item.id, line);
    }
    deps.receipts.remove(id);
    return receipt.files;
  });
  // Files can't roll back, so they go once the rest has stuck. The prices are saved either way.
  try {
    for (const file of files) deps.receiptFiles.remove(file);
  } catch (e) {
    deps.log(`receipt ${id}'s files couldn't be removed: ${(e as Error).message}`);
  }
}

function stock(
  deps: Deps, item: PantryItem | null, line: ReceiptLine, trip: { list: TripLine[] | null }, shopDate: ISODate,
): PantryItem {
  if (!item) {
    const blank = { count: null, portions: [] } as unknown as PantryItem;
    return addPantryItem(deps, { name: line.name, category: line.category, status: 'have', occasional: true, lastsDays: line.lastsDays, ...afterBuying(blank, line) });
  }
  // Bought to tuck away, whether that was recorded earlier or is only now, so only what's left of the line goes to the fridge.
  const { remainder } = storeFromReceipt(deps, shopDate, item, line);
  const current = deps.pantry.get(item.id) ?? item;
  if (remainder <= 0) return current;
  // What checking it off already added is on this receipt too, once, however many receipts or lines follow.
  const credit = creditCheckOff(trip.list ?? [], current.id);
  if (trip.list) trip.list = credit.list;
  const lastsDays = current.lastsDays === null && line.lastsDays ? { lastsDays: line.lastsDays } : {};
  return updatePantryItem(deps, current.id, { status: 'have', ...lastsDays, ...afterBuying(current, remainderOfLine(line, remainder), credit.added) })!;
}

/** One of the files a receipt came as, or null when it has no such file. */
export function receiptFile(deps: Deps, id: number, index: number): { data: Buffer; type: string } | null {
  const file = deps.receipts.get(id)?.files[index];
  return file ? { data: deps.receiptFiles.read(file), type: file.type } : null;
}

export function removeReceipt(deps: Deps, id: number): void {
  const receipt = deps.receipts.get(id);
  if (!receipt) return;
  for (const file of receipt.files) deps.receiptFiles.remove(file);
  deps.receipts.remove(id);
}

const currentStatus = (r: ReceiptRecord, now: number): Pick<ReceiptRecord, 'status' | 'error'> =>
  r.status === 'reading' && now - new Date(r.createdAt).getTime() > READING_LIMIT_MS
    ? { status: 'failed', error: 'That took too long. It’s saved, so you can try again.' }
    : { status: r.status, error: r.error };

export function receiptView(deps: Deps, id: number): ReceiptView | null {
  const receipt = deps.receipts.get(id);
  if (!receipt) return null;
  const { list, diff } = receiptOnTrip(deps, receipt);
  return {
    id, shopDate: receipt.shopDate, store: receipt.store, purchasedOn: receipt.purchasedOn, totalCents: receipt.totalCents, lines: receipt.lines,
    ...currentStatus(receipt, Date.now()),
    files: receipt.files.map((f, i) => ({ url: `/api/receipts/${id}/files/${i}`, type: f.type })),
    listSaved: list !== null,
    leftOut: receipt.status === 'ready' ? leftOutLines(deps, receipt.lines, list ?? []) : [],
    old: receipt.purchasedOn !== null && receipt.purchasedOn < addDays(toISODate(new Date()), -TRIP_WINDOW_DAYS),
    diff,
  };
}

/** The trip's saved list, and how this receipt and the others saved for that trip compare with it. */
export function receiptOnTrip(deps: Deps, receipt: ReceiptRecord): { list: TripLine[] | null; diff: TripDiff } {
  const list = deps.receipts.tripList(receipt.shopDate);
  const onTrip = deps.receipts.list().filter(r => r.shopDate === receipt.shopDate && r.status === 'applied' && r.id !== receipt.id);
  return { list, diff: tripDiff(list ?? [], [...onTrip, receipt]) };
}

export function tripsView(deps: Deps, now = new Date()): TripsView {
  const receipts = deps.receipts.list();
  const summaries: ReceiptSummary[] = receipts.map(r => ({
    id: r.id, shopDate: r.shopDate, store: r.store, totalCents: r.totalCents, itemCount: r.lines.length, ...currentStatus(r, now.getTime()),
  }));
  const applied = receipts.filter(r => r.status === 'applied');
  const dates = [...new Set(applied.map(r => r.shopDate))].sort().reverse();
  const trips = dates.map(date => tripDiff(deps.receipts.tripList(date) ?? [], applied.filter(r => r.shopDate === date)));
  return { receipts: summaries, suggestions: tripSuggestions(trips, deps.pantry.list(), dismissedSuggestions(deps)) };
}

function dismissedSuggestions(deps: Deps): Set<string> {
  return new Set(JSON.parse(deps.household.setting(DISMISSED) ?? '[]') as string[]);
}

export function dismissSuggestion(deps: Deps, key: string): void {
  deps.household.saveSetting(DISMISSED, JSON.stringify([...dismissedSuggestions(deps), key]));
}

