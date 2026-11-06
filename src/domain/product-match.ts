// Picking the store product a list line means. A search returns a mix (organic, family
// packs, the wrong spice); the product should contain every word of the item, and among
// those, the everyday one is usually the cheapest.
import { nameKey } from './pantry.ts';

export type ProductCandidate = { name: string; cents: number };

export function bestProduct<T extends ProductCandidate>(item: string, candidates: readonly T[]): T | null {
  const wanted = nameKey(item);
  if (!wanted.length) return null;
  const fits = candidates.filter(c => {
    const words = new Set(nameKey(c.name));
    return wanted.every(w => words.has(w));
  });
  return [...fits].sort((a, b) => a.cents - b.cents)[0] ?? null;
}
