// What the tidy-up keeps in household settings: the questions waiting on Today, what it won't ask again for a while,
// and a short log of its runs.
import type { Quiet } from '../../domain/tidy-memory.ts';
import type { TidyRun } from '../../domain/tidy-log.ts';
import type { PendingQuestion } from '../../domain/tidy-questions.ts';
import type { Deps } from './deps.ts';

const PENDING = 'tidy_up_pending';
const QUIET = 'tidy_up_quiet';
const LOG = 'tidy_up_log';

function read<T>(deps: Deps, key: string, empty: T): T {
  return JSON.parse(deps.household.setting(key) ?? 'null') ?? empty;
}

function write(deps: Deps, key: string, value: unknown, empty: boolean): void {
  deps.household.saveSetting(key, empty ? null : JSON.stringify(value));
}

export const pendingQuestions = (deps: Deps): PendingQuestion[] => read(deps, PENDING, []);
export const savePending = (deps: Deps, pending: PendingQuestion[]): void => write(deps, PENDING, pending, !pending.length);

export const quietFingerprints = (deps: Deps): Quiet => read(deps, QUIET, {});
export const saveQuiet = (deps: Deps, quiet: Quiet): void => write(deps, QUIET, quiet, !Object.keys(quiet).length);

export const tidyLog = (deps: Deps): TidyRun[] => read(deps, LOG, []);
export const saveTidyLog = (deps: Deps, log: TidyRun[]): void => write(deps, LOG, log, !log.length);
