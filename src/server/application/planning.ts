// The one way into planning. A run can spend minutes waiting on the model, so runs never overlap:
// one goes at a time, and everything asked for meanwhile either joins it or shares one run after it.
import type { ISODate } from '../../domain/dates.ts';
import { mergedRequests, rangeToFill, runCovers, type PlanRequest } from '../../domain/planning-run.ts';
import { planHorizonEnd } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';
import { fillPlan } from './fill-plan.ts';
import { keepPlanCookable } from './keep-plan-cookable.ts';
import { shopSchedule } from './shop-schedule.ts';

export type PlanResult = { replaced: number; added: number };

type Run = { request: PlanRequest; done: Promise<PlanResult> };
type Runs = { active: Run | null; next: Run | null };

// One queue per server. Only this file touches it, so it stays here; LookupState is in Deps because several use cases share it.
const runsByDeps = new WeakMap<Deps, Runs>();

/** Make sure the plan holds and reaches `through` (null: only refill what no longer fits). A run already covering that will do. */
export function planAhead(deps: Deps, today: ISODate, through: ISODate | null): Promise<PlanResult> {
  const { active } = runsFor(deps);
  return active && runCovers(active.request, { today, through }) ? active.done : queue(deps, { today, through });
}

/** Plans through the week of the next shopping trip, which is as far ahead as the plan ever reaches. */
export function planToHorizon(deps: Deps, today: ISODate): Promise<PlanResult> {
  return planAhead(deps, today, planHorizonEnd(today, shopSchedule(deps)));
}

/** Something planning depends on just changed (the shopping day), so a run already going won't do: this one starts after it. */
export function replanAfterChange(deps: Deps, today: ISODate, through: ISODate): Promise<PlanResult> {
  return queue(deps, { today, through });
}

function queue(deps: Deps, request: PlanRequest): Promise<PlanResult> {
  const runs = runsFor(deps);
  if (runs.next) {
    runs.next.request = mergedRequests(runs.next.request, request);
    return runs.next.done;
  }
  if (!runs.active) return start(deps, runs, request);
  const next: Run = {
    request,
    done: runs.active.done.catch(() => undefined).then(() => {
      runs.next = null;
      return start(deps, runs, next.request);
    }),
  };
  runs.next = next;
  return next.done;
}

function start(deps: Deps, runs: Runs, request: PlanRequest): Promise<PlanResult> {
  const done = plan(deps, request).finally(() => { runs.active = null; });
  runs.active = { request, done };
  return done;
}

async function plan(deps: Deps, request: PlanRequest): Promise<PlanResult> {
  const removed = keepPlanCookable(deps, request.today);
  if (removed.length) deps.log(`replanning ${removed.length} meal(s) that no longer fit (pantry or season)`);
  const range = rangeToFill(request, removed.map(e => e.date));
  const added = range ? await fillPlan(deps, range.from, range.through) : 0;
  return { replaced: removed.length, added };
}

function runsFor(deps: Deps): Runs {
  let runs = runsByDeps.get(deps);
  if (!runs) {
    runs = { active: null, next: null };
    runsByDeps.set(deps, runs);
  }
  return runs;
}
