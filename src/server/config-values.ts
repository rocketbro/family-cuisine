// How raw environment values become settings. Pure, so the rules can be tested without
// touching the real environment.
import path from 'node:path';

/** `.env` files don't expand `~`, so a literal one would create a folder named "~" in the checkout. */
export function expandHome(value: string, home: string): string {
  if (value === '~') return home;
  return value.startsWith('~/') ? path.join(home, value.slice(2)) : value;
}

/** A path setting: `~` expanded, and anything relative made absolute from the working directory. */
export function pathSetting(value: string, home: string, cwd: string): string {
  return path.resolve(cwd, expandHome(value, home));
}

/** Where data lives unless CUISINE_DATA_DIR says otherwise. */
export function defaultDataDir(platform: string, home: string, xdgDataHome: string | undefined): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Cuisine');
  return path.join(xdgDataHome || path.join(home, '.local', 'share'), 'cuisine');
}

/** Off unless someone plainly turned it on. A typo leaves it off. */
export function flagIsOn(value: string | undefined): boolean {
  return ['on', 'true', '1', 'yes'].includes((value ?? '').trim().toLowerCase());
}
