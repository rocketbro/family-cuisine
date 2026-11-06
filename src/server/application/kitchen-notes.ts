// The family's standing rules for how they cook and what they cook with, in their own words.
// Claude reads them whenever it plans a meal or writes a recipe.
import type { HouseholdRepository } from './ports/household.ts';

const KEY = 'kitchen_notes';

export function kitchenNotes({ household }: { household: Pick<HouseholdRepository, 'setting'> }): string | null {
  return household.setting(KEY);
}

export function setKitchenNotes({ household }: { household: Pick<HouseholdRepository, 'saveSetting'> }, notes: string): void {
  household.saveSetting(KEY, notes.trim() || null);
}
