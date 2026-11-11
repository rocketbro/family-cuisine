// What happens on its own: the plan on the morning of each grocery run, a nightly top-up so every morning has a plan, the
// trip's list on record, old recordings cleared, and the notifications. A run counts as done only once its work succeeded,
// so a failure or a restart gets it again later. A trip's plan missed altogether runs when the service
// is next up. Both planning runs can be turned off in Settings, and wait after the plan is cleared. Notifications are the exception to retrying blindly: once one may have gone out, it's never sent again.
import { addDays, toISODate, type ISODate } from '../../domain/dates.ts';
import { checkinNotice } from '../../domain/checkin-notice.ts';
import { minutesOf } from '../../domain/job-run.ts';
import { mealsOffNotice, mealsOffNoticeDue } from '../../domain/meal-off.ts';
import { nightBeforeNotice, nightBeforeTasks, reminderWindowOpen } from '../../domain/night-before-reminder.ts';
import { extrasOnly } from '../../domain/plan-slot.ts';
import { tripWindow } from '../../domain/shop-schedule.ts';
import { nightlyRuns, tripMorningRuns } from '../../domain/automatic-planning.ts';
import { receiptPromptDue, tripNoticeFits, tripPlanDue } from '../../domain/trip-plan-run.ts';
import { tripMorningNotice, tripReceiptNotice } from '../../domain/trip-notices.ts';
import { checkinLeftToAsk } from './checkin-open.ts';
import { automaticPlanning } from './automatic-planning.ts';
import { shopSchedule } from './shop-schedule.ts';
import type { JobSchedule } from '../../domain/job-run.ts';
import type { Deps } from './deps.ts';
import { markMealsOffTold, untoldMealsOff } from './meals-off.ts';
import { backfillNightBefore } from './night-before-backfill.ts';
import { nightBeforeTime } from './night-before-time.ts';
import { planAhead } from './planning.ts';
import { keepTripList } from './receipts.ts';
import { shoppingWeek } from './shopping.ts';

export type Schedule = JobSchedule;

type Message = Parameters<Deps['notifier']['send']>[0];

/** Nightly: make sure today and tomorrow are planned. */
const TOP_UP_HOUR = 3;
/** After this long, a run that never finished (the server restarted) is picked up again. */
const LEASE_MS = 15 * 60_000;
/** How long a run that failed waits before trying again. */
const RETRY_MS = 5 * 60_000;
const REMINDER_JOB = 'night-before';
const MEALS_OFF_JOB = 'meals-off';
const BACKFILL_JOB = 'night-before-backfill';
const BACKFILL_RUN = 'once';
/** A one-time job with nowhere to be, which spends tokens each go: a failure waits longer. */
const BACKFILL_RETRY_MS = 60 * 60_000;

export async function runDueJobs(deps: Deps, schedule: Schedule, now: Date): Promise<void> {
  const today = toISODate(now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (now.getHours() >= TOP_UP_HOUR) {
    // Recordings are promised to last a week, not until the next restart.
    await retried(deps, 'recordings-sweep', today, now, () => {
      const removed = deps.recordings.sweep();
      if (removed) deps.log(`removed ${removed} recording(s) older than a week`);
    });
    if (nightlyRuns(automaticPlanning(deps))) await retried(deps, 'top-up', today, now, () => planAhead(deps, today, addDays(today, 1)));
    // So a trip has its list on record even if nobody opens the screen before going.
    await retried(deps, 'trip-list', today, now, () => {
      const week = shoppingWeek(deps, today);
      keepTripList(deps, week.shopDate, week.lines);
    });
  }

  const planStart = schedule.planTime.hour * 60 + schedule.planTime.minute;
  const checkinStart = schedule.checkinTime.hour * 60 + schedule.checkinTime.minute;

  // Keyed by the trip, not today, so a late run still counts as that trip's one run.
  const shop = shopSchedule(deps);
  const trip = tripPlanDue(today, minutes, shop, planStart);
  if (trip) {
    const plans = tripMorningRuns(automaticPlanning(deps));
    if (plans) await retried(deps, 'trip-plan', trip, now, () => tripPlan(deps, today));
    if ((!plans || deps.household.jobCompleted('trip-plan', trip)) && tripNoticeFits(trip, today, minutes, planStart)) {
      await notifyOnce(deps, 'trip-notice', trip, now, tripMorningNotice(today, shop, plans));
    }
  }

  if (mealsOffNoticeDue(minutes, planStart)) await tellMealsOff(deps, today, now);

  if (receiptPromptDue(today, minutes, shop, checkinStart) && !deps.receipts.list().some(r => r.shopDate === today)) {
    await notifyOnce(deps, 'trip-receipt', today, now, tripReceiptNotice(today));
  }

  // Only within two hours of the set time: a late restart shouldn't buzz phones at midnight.
  if (minutes >= checkinStart && minutes < checkinStart + 120) {
    // Meals checked off on Today answer their questions there; with nothing left, there's nothing to nudge about.
    if (checkinLeftToAsk(deps, today)) {
      const extras = extrasOnly(deps.plan.range(today, today)).flatMap(e => deps.recipes.get(e.recipeSlug ?? '')?.title ?? e.note ?? []);
      await notifyOnce(deps, 'checkin', today, now, { ...checkinNotice(extras), url: `/checkin/${today}` });
    }
  }

  if (reminderWindowOpen(minutes, minutesOf(nightBeforeTime(deps)))) await nightBeforeReminder(deps, today, now);

  // Last, since it can take a few minutes on the model. With no key it isn't done, so a key added later still gets it.
  if (deps.ai.available()) await retried(deps, BACKFILL_JOB, BACKFILL_RUN, now, () => backfillNightBefore(deps), BACKFILL_RETRY_MS);
}

/**
 * One look per evening. With nothing to do, that's it for the day, so a meal planned after the set
 * time gets no buzz: the Day and recipe screens say so instead.
 */
async function nightBeforeReminder(deps: Deps, today: ISODate, now: Date): Promise<void> {
  if (deps.household.jobCompleted(REMINDER_JOB, today)) return;
  const tomorrow = addDays(today, 1);
  const message = nightBeforeNotice(nightBeforeTasks(deps.plan.range(tomorrow, tomorrow), slug => deps.recipes.get(slug)));
  if (message) await notifyOnce(deps, REMINDER_JOB, today, now, message);
  else if (deps.household.claimJob(REMINDER_JOB, today, now.toISOString(), null)) deps.household.completeJob(REMINDER_JOB, today);
}

/** One notice a morning. Anything that comes off after it waits for the next, and the Day screen says so meanwhile. */
async function tellMealsOff(deps: Deps, today: ISODate, now: Date): Promise<void> {
  if (deps.household.jobCompleted(MEALS_OFF_JOB, today)) return;
  const offs = untoldMealsOff(deps, today);
  if (!offs.length) return;
  await notifyOnce(deps, MEALS_OFF_JOB, today, now, mealsOffNotice(offs, today));
  if (deps.household.jobCompleted(MEALS_OFF_JOB, today)) markMealsOffTold(deps, offs);
}

/** Safe to run again, so a run that fails or never finishes simply gets another go. */
async function retried(deps: Deps, job: string, runKey: string, now: Date, work: () => unknown, retryMs = RETRY_MS): Promise<void> {
  if (!deps.household.claimJob(job, runKey, now.toISOString(), later(now, LEASE_MS))) return;
  try {
    await work();
    deps.household.completeJob(job, runKey);
  } catch (error) {
    deps.log(`${job} failed, will retry: ${(error as Error).message}`);
    deps.household.releaseJob(job, runKey, later(now, retryMs));
  }
}

/**
 * Retried only when it's certain no phone got it. The claim never expires, because a restart in the
 * middle of sending can't tell who got it: better one missed nudge than two.
 */
async function notifyOnce(deps: Deps, job: string, runKey: string, now: Date, message: Message): Promise<void> {
  if (!deps.household.claimJob(job, runKey, now.toISOString(), null)) return;
  try {
    const delivered = await deps.notifier.send(message);
    if (delivered === 0 && deps.notifier.enabled() && deps.subscriptions.list().length) throw new Error('no phone could be reached');
    deps.household.completeJob(job, runKey);
    deps.log(`${job} sent to ${delivered} device(s)`);
  } catch (error) {
    deps.log(`${job} failed, will retry: ${(error as Error).message}`);
    deps.household.releaseJob(job, runKey, later(now, RETRY_MS));
  }
}

function later(now: Date, ms: number): string {
  return new Date(now.getTime() + ms).toISOString();
}

async function tripPlan(deps: Deps, today: ISODate): Promise<void> {
  const { added } = await planAhead(deps, today, tripWindow(today, shopSchedule(deps)).end);
  deps.log(`trip plan: ${added} meals added`);
}
