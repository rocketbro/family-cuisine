// The fixed menu of things an answer to a tidy-up question can do. Claude names one of these; code checks it against
// the candidate it was offered for and drops anything else, so the model never reaches outside what was put in front of it.
import { isRealDate } from './dates.ts';
import { isPlanSlot } from './plan-slot.ts';
import type { ActionKind, Candidate, TidyAction } from './tidy-types.ts';

export const ACTION_KINDS: ActionKind[] = ['merge_items', 'set_status', 'set_count', 'clear_use_by', 'add_other_name', 'remove_plan_entry'];

/** An action as the model writes it: every field present, the ones that don't apply null. */
export type SaidAction = {
  kind: string;
  keep: number | null; remove: number | null; itemId: number | null;
  status: string | null; count: number | null;
  name: string | null; newName: string | null; alsoCalled: string[] | null;
  date: string | null; slot: string | null;
};

const MAX_NAME = 60;
const MAX_COUNT = 999;

const cleanName = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** A name an action may use: one the candidate listed, compared by its words. */
function listed(candidate: Candidate, text: string | null | undefined): string | null {
  const name = cleanName(text);
  if (!name || name.length > MAX_NAME) return null;
  return candidate.scope.names.find(n => n.toLowerCase() === name.toLowerCase()) ?? null;
}

const inScope = (candidate: Candidate, id: number | null) => id !== null && candidate.scope.items.some(i => i.id === id);

/** The action, or null when it isn't one this candidate allows or names something outside it. */
export function checkedAction(said: SaidAction, candidate: Candidate): TidyAction | null {
  const kind = said.kind as ActionKind;
  if (!candidate.allowed.includes(kind)) return null;
  switch (kind) {
    case 'merge_items': {
      const { keep, remove } = said;
      if (keep === null || remove === null || keep === remove || !inScope(candidate, keep) || !inScope(candidate, remove)) return null;
      const alsoCalled = (said.alsoCalled ?? []).flatMap(n => listed(candidate, n) ?? []);
      return { kind, keep, remove, newName: listed(candidate, said.newName), alsoCalled: [...new Set(alsoCalled)] };
    }
    case 'set_status':
      return inScope(candidate, said.itemId) && candidate.scope.statuses.some(s => s === said.status)
        ? { kind, itemId: said.itemId!, status: candidate.scope.statuses.find(s => s === said.status)! } : null;
    case 'set_count':
      return inScope(candidate, said.itemId) && said.count !== null && Number.isInteger(said.count) && said.count >= 0 && said.count <= MAX_COUNT
        ? { kind, itemId: said.itemId!, count: said.count } : null;
    case 'clear_use_by':
      return inScope(candidate, said.itemId) ? { kind, itemId: said.itemId! } : null;
    case 'add_other_name': {
      const name = listed(candidate, said.name);
      return inScope(candidate, said.itemId) && name ? { kind, itemId: said.itemId!, name } : null;
    }
    case 'remove_plan_entry': {
      const entry = candidate.scope.entries.find(e => e.date === said.date && e.slot === said.slot);
      return entry && said.date && isRealDate(said.date) && said.slot && isPlanSlot(said.slot) ? { kind, date: entry.date, slot: entry.slot } : null;
    }
    default:
      return null;
  }
}
