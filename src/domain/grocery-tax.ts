// Sales tax on a grocery list. Groceries aren't taxed at a place's general rate, so a ZIP's
// general rate would overstate this.
// North Carolina taxes qualifying food at a flat 2% statewide (ncdor.gov), so the ZIP's state
// settles it. Other states aren't filled in: their food rates vary locally, and no line beats
// a wrong one. It's an estimate: candy, soda and household items cost more than this.

const RATE_BY_STATE: Record<string, number> = { NC: 0.02 };

/** "Raleigh, NC" → 0.02; null where we don't know the state's food rate. */
export function groceryTaxRate(place: string): number | null {
  const state = place.match(/,\s*([A-Z]{2})$/)?.[1];
  return state ? RATE_BY_STATE[state] ?? null : null;
}

export type ListTax = { rate: number; cents: number };

export function listTax(subtotalCents: number, rate: number | null): ListTax | null {
  return rate === null ? null : { rate, cents: Math.round(subtotalCents * rate) };
}
