// Items the Aldi lookup searched for and couldn't match, so opening the list doesn't search
// for them again every time. They're retried after a week, like found prices.
import type { Deps } from './deps.ts';

const KEY = 'aldi_lookup_misses';
const RETRY_DAYS = 7;

export function recentMisses(deps: Deps, now: Date): Set<string> {
  const saved = JSON.parse(deps.household.setting(KEY) ?? '{}') as Record<string, string>;
  return new Set(Object.entries(saved).filter(([, at]) => now.getTime() - new Date(at).getTime() < RETRY_DAYS * 86_400_000).map(([name]) => name));
}

export function recordMisses(deps: Deps, names: string[], now: Date): void {
  const saved = JSON.parse(deps.household.setting(KEY) ?? '{}') as Record<string, string>;
  for (const name of names) saved[name] = now.toISOString();
  deps.household.saveSetting(KEY, JSON.stringify(saved));
}

export function forgetMisses(deps: Deps): void {
  deps.household.saveSetting(KEY, null);
}
