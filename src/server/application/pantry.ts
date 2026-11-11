// Keeping the pantry roughly right with as little effort as possible.
import { toISODate, type ISODate } from '../../domain/dates.ts';
import { statusForCount, type PantryItem } from '../../domain/pantry.ts';
import { additionAsChange, type StockToAdd } from '../../domain/portion-add.ts';
import { portionsAfterMove, stockAsPortions, type PortionMove } from '../../domain/portion-move.ts';
import { mergePortions, soonestDate, type PortionChange } from '../../domain/portions.ts';
import { dateAfterChange } from '../../domain/use-by.ts';
import type { Deps } from './deps.ts';
import type { PantryInput } from './ports/pantry.ts';
import type { ProposedChange } from '../../shared/api-types.ts';
import { forgetStandIns, forgetStandInsOnceOut } from './stand-ins.ts';
import { UserError } from './user-error.ts';

/** A change to an item, and to its portions if it has any. */
export type PantryPatch = Partial<PantryInput> & { portions?: PortionChange[]; move?: PortionMove; add?: StockToAdd };

export function listPantry(deps: Deps): PantryItem[] {
  return deps.pantry.list();
}

export function addPantryItem(deps: Deps, { portions, ...input }: PantryInput & { portions?: PortionChange[] }): PantryItem {
  const name = input.name.trim();
  if (!name) throw new UserError('Give the item a name.');
  const existing = deps.pantry.findByName(name);
  if (existing) return updatePantryItem(deps, existing.id, { status: input.status ?? 'have', useBy: input.useBy, lastsDays: input.lastsDays, portions })!;
  const status = input.count != null ? statusForCount(input.count) : input.status ?? 'have';
  const dates = dateAfterChange({ status, useBy: null, useByEstimated: false, lastsDays: input.lastsDays ?? null }, { useBy: input.useBy ?? undefined }, toISODate(new Date()));
  const created = deps.pantry.create({ ...input, name, status, ...dates });
  return portions?.length ? updatePantryItem(deps, created.id, { portions })! : created;
}

/** Fresh to frozen or back, worked out from what's stored now, so the total can't drift. */
function moveStock(deps: Deps, item: PantryItem, move: PortionMove, today: ISODate): PantryItem | null {
  const result = portionsAfterMove(stockAsPortions(item), move, item.lastsDays, today);
  if ('problem' in result) throw new UserError(result.problem);
  deps.pantry.setPortions(item.id, result.portions);
  return deps.pantry.update(item.id, { status: item.status === 'low' ? 'low' : 'have', count: null, ...soonestDate(result.portions) });
}

export function updatePantryItem(deps: Deps, id: number, patch: PantryPatch): PantryItem | null {
  // Something that stood in for another name just this time stops when it runs out.
  return forgetStandInsOnceOut(deps, changeItem(deps, id, patch));
}

function changeItem(deps: Deps, id: number, { portions: said, move, add, ...patch }: PantryPatch): PantryItem | null {
  const item = deps.pantry.get(id);
  if (!item) return null;
  if (move) return moveStock(deps, item, move, toISODate(new Date()));
  const changes = add ? [additionAsChange(item, add)] : said;
  // A count drives the status, so the two never disagree.
  const counted = patch.count != null && patch.status === undefined ? { ...patch, status: statusForCount(patch.count) } : patch;
  // A different product means a different package size, read again next time.
  const withStatus = patch.walmartItemId !== undefined && patch.walmartItemId !== item.walmartItemId ? { ...counted, packSize: null } : counted;
  const today = toISODate(new Date());
  if (!item.portions.length && !changes?.some(c => c.amount === null || c.amount > 0)) {
    return deps.pantry.update(id, { ...withStatus, ...dateAfterChange(item, withStatus, today) });
  }
  // Kept in portions: being out clears them all, and the portions decide the rest.
  const portions = withStatus.status === 'out' ? [] : mergePortions(item.portions, changes ?? [], { current: item.lastsDays, changed: withStatus.lastsDays }, today);
  deps.pantry.setPortions(id, portions);
  const status = !portions.length ? 'out' : (withStatus.status ?? item.status) === 'low' ? 'low' : 'have';
  return deps.pantry.update(id, { ...withStatus, status, count: null, ...soonestDate(portions) });
}

export function removePantryItem(deps: Deps, id: number): void {
  deps.pantry.remove(id);
  forgetStandIns(deps, id);
}

type AppliedChange = Pick<ProposedChange, 'name' | 'status' | 'count' | 'category' | 'pantryItemId' | 'useBy' | 'lastsDays' | 'keepStocked' | 'portions' | 'alsoCalled'>;

export function applyPantryChanges(deps: Deps, changes: AppliedChange[]): number {
  for (const change of changes) {
    // A portion with no date said keeps the date it has.
    const portions = change.portions?.map(p => ({ ...p, useBy: p.useBy ?? undefined }));
    if (change.pantryItemId !== null) {
      const item = deps.pantry.get(change.pantryItemId);
      if (!item) continue;
      updatePantryItem(deps, item.id, {
        ...(item.count !== null && change.count !== null && !portions ? { count: change.count } : { status: change.status }),
        ...(portions ? { portions } : {}),
        ...(change.useBy !== null ? { useBy: change.useBy } : {}),
        ...(change.lastsDays !== null ? { lastsDays: change.lastsDays } : {}),
        ...(change.keepStocked !== null ? { occasional: !change.keepStocked } : {}),
        ...(change.alsoCalled?.length ? { alsoCalled: [...new Set([...item.alsoCalled, ...change.alsoCalled])] } : {}),
      });
    } else {
      // Something new that's on hand is "as needed" unless they say otherwise. One they're
      // low on or out of is something they want, so it's regular and reaches the list.
      const occasional = change.keepStocked !== null ? !change.keepStocked : change.status === 'have';
      addPantryItem(deps, {
        name: change.name, category: change.category, status: change.status, count: change.count, occasional,
        useBy: change.useBy, lastsDays: change.lastsDays, alsoCalled: change.alsoCalled ?? [], portions,
      });
    }
  }
  return changes.length;
}
