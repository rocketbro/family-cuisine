import { toISODate, type ISODate } from '../../domain/dates.ts';
import { isExtraSlot, type PlanSlot } from '../../domain/plan-slot.ts';
import { beforeGroceries } from '../../domain/shop-schedule.ts';
import { writePick } from './claudes-picks.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';
import { shopSchedule } from './shop-schedule.ts';
import { UserError } from './user-error.ts';

/** Turns a slot that's just a name ("Sausage and pepper skillet") into a real recipe. */
export async function writeUpNote(deps: Deps, date: ISODate, slot: PlanSlot): Promise<void> {
  const entry = deps.plan.get(date, slot);
  if (entry?.kind !== 'note' || !entry.note) throw new UserError('There’s nothing here to write up.');
  const fromHouse = beforeGroceries(date, toISODate(new Date()), shopSchedule(deps));
  const recipe = await writePick(deps, { title: entry.note, idea: entry.drafted?.how ?? null, slot: isExtraSlot(slot) ? null : slot, fromHouse });
  if (!recipe) throw new UserError('That one couldn’t be written up.', 502);
  // Writing takes a while: keep anything done to the meal since, and leave it be if it became something else.
  const latest = deps.plan.get(date, slot);
  if (latest?.kind !== 'note' || latest.note !== entry.note) return;
  deps.plan.upsert({
    ...latest, kind: 'recipe', recipeSlug: recipe.slug, multiplier: batchFor(deps, recipe.serves), note: null,
    drafted: latest.drafted && { ...latest.drafted, how: null },
  });
}
