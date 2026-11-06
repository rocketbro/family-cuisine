// Which parts of a put-away have been done, by the token the app sends with it. Trying again after a
// lost answer sends the same token, so it can't add twice, even if a receipt has moved the count or
// the day has turned over. Trying again with one more box ticked still does that one.
import type { Deps } from './deps.ts';

const KEY = 'put_away_requests';
/** Plenty for any retry to still be remembered. */
const REMEMBERED = 500;

/** Which of these haven't been done for this token, marking them done. With no token, nothing is known, so all of them. */
export function firstTimeOnly(deps: Deps, token: string | null, parts: readonly string[]): Set<string> {
  if (!token) return new Set(parts);
  const done: string[] = JSON.parse(deps.household.setting(KEY) ?? '[]');
  const fresh = parts.filter(part => !done.includes(`${token}/${part}`));
  if (fresh.length) deps.household.saveSetting(KEY, JSON.stringify([...done, ...fresh.map(part => `${token}/${part}`)].slice(-REMEMBERED)));
  return new Set(fresh);
}
