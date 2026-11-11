// The review's "Tell Claude": its words go to Claude with the plan as it stands on screen
// (`useClaudeRevision`), and go through again if the review comes back after closing.
import type { ISODate } from '../../../domain/dates.ts';
import type { ImportedMeal } from '../../../domain/plan-import.ts';
import { api } from '../../api.ts';
import { useClaudeRevision } from '../../dictation/useClaudeRevision.ts';

type Options = {
  id: string;
  meals: ImportedMeal[];
  onDate: ISODate | null;
  onRevised: (meals: ImportedMeal[], note: string) => void;
};

export function usePlanRevision({ id, meals, onDate, onRevised }: Options) {
  return useClaudeRevision({
    field: `plan-import-review:${id}`,
    label: 'Changes to the plan',
    ask: said => api.revisePlanImport(id, said, onDate, meals),
    onAnswer: revision => onRevised(revision.meals, revision.note),
  });
}
