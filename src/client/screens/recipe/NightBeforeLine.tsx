// What has to happen the evening before, near the top of the recipe. When a planned meal makes it
// pressing, it says so, however the recipe was opened. Someone who just planned it for tomorrow or
// today isn't stopped, only told, here.
import { Moon } from 'lucide-react';
import { addDays } from '../../../domain/dates.ts';
import { dueForRecipe, nightBeforeLine } from '../../../domain/night-before.ts';
import { api } from '../../api.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useToday } from '../../hooks/useToday.ts';

export function NightBeforeLine({ slug, step }: { slug: string; step: string }) {
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const { data: entries } = useLoad(`night-before-plan:${today}`, () => api.plan(today, tomorrow));
  const due = entries ? dueForRecipe(entries, slug, today) : null;
  return <p className="night-before on-recipe"><Moon size={16} aria-hidden="true" /><span>{due ? nightBeforeLine(step, due) : `Night before: ${step}`}</span></p>;
}
