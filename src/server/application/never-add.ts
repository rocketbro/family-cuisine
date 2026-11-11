// Products the family never adds from a receipt, kept as one JSON value. Remembered when a receipt
// is saved, so nothing changes before Save, and taken back one at a time in Settings → Shopping.
import { withNeverAdded, type NeverAdd } from '../../domain/never-add.ts';
import type { Deps } from './deps.ts';

const KEY = 'never_add';

export function neverAddList(deps: Deps): NeverAdd[] {
  return JSON.parse(deps.household.setting(KEY) ?? '[]') as NeverAdd[];
}

export function rememberNeverAdd(deps: Deps, lines: { printed: string; name: string }[]): void {
  if (!lines.length) return;
  deps.household.saveSetting(KEY, JSON.stringify(withNeverAdded(neverAddList(deps), lines)));
}

export function forgetNeverAdd(deps: Deps, id: number): void {
  deps.household.saveSetting(KEY, JSON.stringify(neverAddList(deps).filter(entry => entry.id !== id)));
}
