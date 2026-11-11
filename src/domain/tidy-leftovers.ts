// Leftovers still to come of a dinner nobody ever marked made or skipped. Only a made dinner has leftovers
// (`madeName`), but a person may simply not have said, so this is a question rather than a fix.
import { dishName } from './leftovers.ts';
import { entryKey } from './plan.ts';
import { slotLabel } from './plan-slot.ts';
import type { Candidate, TidyInputs } from './tidy-types.ts';

export function unconfirmedLeftovers({ plan, recipes, today }: Pick<TidyInputs, 'plan' | 'recipes' | 'today'>): Candidate[] {
  const byKey = new Map(plan.map(e => [entryKey(e), e]));
  const titleOf = (slug: string) => recipes.find(r => r.slug === slug)?.title ?? null;
  return plan.flatMap((e): Candidate[] => {
    if (e.kind !== 'leftovers' || !e.leftoversOf || e.outcome || e.date < today) return [];
    const source = byKey.get(entryKey(e.leftoversOf));
    if (!source || source.outcome || source.date >= today) return [];
    const dish = dishName(source, titleOf) ?? 'a meal';
    return [{
      fingerprint: `leftovers:${e.date}:${e.slot}`,
      kind: 'unconfirmed_leftovers',
      evidence: [
        `${slotLabel(e.slot)} on ${e.date} is planned as leftovers of ${dish} from ${source.date}, which nobody marked as made or skipped.`,
        e.pinned ? 'Someone chose these leftovers themselves.' : 'The planner chose these leftovers.',
      ],
      allowed: ['remove_plan_entry'],
      scope: { items: [], entries: [{ date: e.date, slot: e.slot }], statuses: [], names: [] },
    }];
  });
}
