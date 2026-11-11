import type { ISODate } from '../../../domain/dates.ts';
import type { Store } from '../../../domain/pantry.ts';

export type HouseholdRepository = {
  storeFor(shopDate: ISODate): Store | null;
  setStore(shopDate: ISODate, store: Store): void;
  checkin(date: ISODate): { mealsDone: boolean; pantryDone: boolean };
  markCheckin(date: ISODate, step: 'meals' | 'pantry'): void;
  /** The earliest day anyone checked in, or null before the first time. */
  firstCheckin(): ISODate | null;
  /** Household-wide settings by key (shopping weekday, budget), as stored strings. */
  setting(key: string): string | null;
  saveSetting(key: string, value: string | null): void;
  /** One-off trip moves: regular trip date → actual date. */
  /** The shopping trips on record, in order. */
  shopTrips(): ISODate[];
  saveShopTrips(dates: readonly ISODate[]): void;
  /** Starts a scheduled job run; false when it's finished or claimed. A null lease never expires on its own. */
  claimJob(job: string, runKey: string, now: string, leaseUntil: string | null): boolean;
  jobCompleted(job: string, runKey: string): boolean;
  completeJob(job: string, runKey: string): void;
  /** The run failed: it can be claimed again from this time. */
  releaseJob(job: string, runKey: string, retryAt: string): void;
};
