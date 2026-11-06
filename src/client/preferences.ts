// Preferences live on each phone, not the server: text size, typeface, theme, what the list shows.
// index.html applies them before first paint; this module changes them afterwards.
import { useState } from 'react';

/** What each line on the grocery list shows besides the item's name. */
export type ListView = { reason: boolean; product: boolean; price: boolean };

export type Preferences = {
  size: 's' | 'm' | 'l' | 'xl'; font: 'serif' | 'sans'; theme: 'auto' | 'light' | 'dark'; person: string;
  listView: ListView; swipeHintSeen: boolean; hideClaudesPicks: boolean;
};

const KEY = 'cuisine.preferences';
const DEFAULTS: Preferences = { size: 'm', font: 'serif', theme: 'auto', person: '', listView: { reason: true, product: true, price: true }, swipeHintSeen: false, hideClaudesPicks: false };

export function readPreferences(): Preferences {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Preferences): void {
  const root = document.documentElement;
  root.dataset.size = p.size;
  root.dataset.font = p.font;
  root.dataset.theme = p.theme;
}

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const [prefs, setPrefs] = useState(readPreferences);
  const update = (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    apply(next);
    setPrefs(next);
  };
  return [prefs, update];
}
