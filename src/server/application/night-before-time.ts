// When the evening's night-before reminder goes out: the time set in Settings, or the .env default.
import { clockValue, parseClock, type ClockTime } from '../../domain/job-run.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

const KEY = 'night_before_time';

type Reads = { household: Pick<Deps['household'], 'setting'>; settings: Pick<Deps['settings'], 'nightBeforeTime'> };

export function nightBeforeTime(deps: Reads): ClockTime {
  return parseClock(deps.household.setting(KEY)) ?? deps.settings.nightBeforeTime;
}

export function saveNightBeforeTime(deps: Pick<Deps, 'household'>, time: string): void {
  const clock = parseClock(time);
  if (!clock) throw new UserError('That isn’t a time of day.');
  deps.household.saveSetting(KEY, clockValue(clock));
}
