import type { PlanEntryView } from '../../shared/views.ts';

/** A planned meal in a few words. */
export function entryTitle(entry: PlanEntryView): string {
  if (entry.kind === 'leftovers') return `Leftovers${entry.leftoversTitle ? ` · ${entry.leftoversTitle}` : ''}`;
  return entry.recipe?.title ?? entry.note ?? '—';
}
