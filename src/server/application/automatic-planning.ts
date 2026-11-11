// The household's choice of what gets planned without asking. See `domain/automatic-planning.ts`.
import { readAutomaticPlanning, type AutomaticPlanning } from '../../domain/automatic-planning.ts';
import type { Deps } from './deps.ts';

const KEY = 'automatic_planning';

type Household = Pick<Deps, 'household'>;

export function automaticPlanning(deps: Household): AutomaticPlanning {
  return readAutomaticPlanning(deps.household.setting(KEY));
}

export function saveAutomaticPlanning(deps: Household, choice: AutomaticPlanning): void {
  deps.household.saveSetting(KEY, JSON.stringify(choice));
}

export function holdAutomaticPlanning(deps: Household): void {
  saveAutomaticPlanning(deps, { ...automaticPlanning(deps), held: true });
}

/** Someone planned, so a plan that was cleared is theirs to keep building on. */
export function resumeAutomaticPlanning(deps: Household): void {
  if (automaticPlanning(deps).held) saveAutomaticPlanning(deps, { ...automaticPlanning(deps), held: false });
}
