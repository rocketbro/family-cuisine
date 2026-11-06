// One recipe's working session: the swaps chosen for it, whether cook mode is on, and what's
// been crossed off. Kept for the browser session, so a reload mid-recipe doesn't lose your
// place. Cancel or "Done making this" ends it, swaps and all.
import { useEffect, useState } from 'react';
import type { Substitutions } from '../../domain/substitutes.ts';

type State = { cooking: boolean; crossed: string[]; substituted: Substitutions };
const EMPTY: State = { cooking: false, crossed: [], substituted: {} };

export function useCookSession(slug: string) {
  const key = `cuisine.cooking.${slug}`;
  const [saved, setSaved] = useState<State & { key: string }>(() => ({ key, ...read(key) }));
  // Moving to another recipe picks up that recipe's session.
  const state = saved.key === key ? saved : { key, ...read(key) };
  const setState = (update: (s: State) => State) => setSaved({ key, ...update(state) });

  useEffect(() => {
    const keep = state.cooking || Object.keys(state.substituted).length > 0;
    if (keep) sessionStorage.setItem(key, JSON.stringify({ cooking: state.cooking, crossed: state.crossed, substituted: state.substituted }));
    else sessionStorage.removeItem(key);
  }, [key, state.cooking, state.crossed, state.substituted]);

  const crossed = new Set(state.crossed);
  return {
    cooking: state.cooking,
    substituted: state.substituted,
    isCrossed: (id: string) => crossed.has(id),
    toggle: (id: string) => setState(s => ({ ...s, crossed: crossed.has(id) ? s.crossed.filter(c => c !== id) : [...s.crossed, id] })),
    setSubstituted: (substituted: Substitutions) => setState(s => ({ ...s, substituted, crossed: [] })),
    start: () => setState(s => ({ ...s, cooking: true, crossed: [] })),
    end: () => setState(() => EMPTY),
  };
}

function read(key: string): State {
  try {
    return { ...EMPTY, ...(JSON.parse(sessionStorage.getItem(key) ?? '') as Partial<State>) };
  } catch {
    return EMPTY;
  }
}
