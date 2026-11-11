// What an answer to a tidy-up question does, through the same use cases a person's own change goes through.
import { mergePatch } from '../../domain/tidy-merge.ts';
import type { TidyAction } from '../../domain/tidy-types.ts';
import type { Deps } from './deps.ts';
import { removePantryItem, updatePantryItem } from './pantry.ts';
import { UserError } from './user-error.ts';

const GONE = 'That has changed since it was asked, so nothing was done.';

function item(deps: Deps, id: number) {
  const found = deps.pantry.get(id);
  if (!found) throw new UserError(GONE, 409);
  return found;
}

export function applyAction(deps: Deps, action: TidyAction): void {
  deps.unitOfWork.run(() => {
    switch (action.kind) {
      case 'merge_items': {
        const keep = item(deps, action.keep);
        const remove = item(deps, action.remove);
        const { name, ...rest } = mergePatch(keep, remove, action.newName, action.alsoCalled);
        // The one going away leaves first, so the name it had is free to take.
        removePantryItem(deps, remove.id);
        updatePantryItem(deps, keep.id, { ...rest, ...(name ? { name } : {}) });
        return;
      }
      case 'set_status':
        updatePantryItem(deps, item(deps, action.itemId).id, { status: action.status });
        return;
      case 'set_count':
        updatePantryItem(deps, item(deps, action.itemId).id, { count: action.count });
        return;
      case 'clear_use_by':
        updatePantryItem(deps, item(deps, action.itemId).id, { useBy: null });
        return;
      case 'add_other_name': {
        const found = item(deps, action.itemId);
        updatePantryItem(deps, found.id, { alsoCalled: [...found.alsoCalled, action.name] });
        return;
      }
      case 'remove_plan_entry': {
        const entry = deps.plan.get(action.date, action.slot);
        // Only what is still just a plan: anything recorded since stays.
        if (!entry || entry.outcome || entry.pantrySettled || entry.checkinSettled) throw new UserError(GONE, 409);
        deps.plan.remove(action.date, action.slot);
        return;
      }
    }
  });
}
