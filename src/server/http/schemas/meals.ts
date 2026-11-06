// Choosing meals, and saying how they went.
import { z } from 'zod';
import { parseUnit } from '../../../domain/units.ts';
import { isoDate, planSlot, slot, stockStatus } from './common.ts';

/** One pantry item a drafted meal uses, as it travels between the app and the server. */
export const mealUse = z.object({
  pantryItemId: z.number(),
  name: z.string(),
  text: z.string(),
  amount: z.number().positive().nullable(),
  unit: z.string().nullable().transform(u => (u ? parseUnit(u) : null)),
  leaves: stockStatus,
});

export const mealChoice = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recipe'), recipeSlug: z.string(), multiplier: z.number().positive().optional() }),
  z.object({ kind: z.literal('leftovers'), leftoversOf: z.object({ date: isoDate, slot }).nullable() }),
  z.object({ kind: z.literal('note'), note: z.string() }),
  z.object({ kind: z.literal('drafted'), draft: z.object({
    title: z.string().min(1), why: z.string(), how: z.string().nullable(), recipeSlug: z.string().nullable(), multiplier: z.number().positive().max(10), uses: z.array(mealUse),
  }) }),
]);

export const chosenSwaps = z.object({ swaps: z.array(z.object({ date: isoDate, slot, toSlug: z.string().min(1), multiplier: z.number().positive().max(10) })).max(21) });

export const mealUpdate = z.object({
  date: isoDate, slot: planSlot, outcome: z.enum(['made', 'swapped', 'skipped']), recipeSlug: z.string().nullable(),
  note: z.string().nullable(), uses: z.array(mealUse).nullable().default(null),
});
