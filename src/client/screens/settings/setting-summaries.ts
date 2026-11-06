// What each row on the Settings screen says is set there, in a few words.
import { WEEKDAYS, shortDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import { nextTrip, type ShopSchedule } from '../../../domain/shop-schedule.ts';
import type { HouseholdProfile } from '../../../domain/household.ts';

export function householdSummary(profile: HouseholdProfile, isSetUp: boolean): string {
  if (!isSetUp) return 'Start here';
  const portions = `${profile.portions} ${profile.portions === 1 ? 'portion' : 'portions'}`;
  return `${portions} · dinner ${profile.dinnerTime}`;
}

export function shoppingSummary(today: ISODate, schedule: ShopSchedule): string {
  const trip = nextTrip(today, schedule);
  return `${WEEKDAYS[schedule.weekday]}s · next trip ${weekdayName(trip).slice(0, 3)}, ${shortDate(trip)}`;
}

export function cookingSummary(notes: string): string {
  return notes.trim().split('\n')[0] || 'Nothing written yet';
}

export function stockUpSummary(names: readonly string[]): string {
  return names.length ? names.join(', ') : 'Nothing yet';
}

export function avoidedSummary(count: number): string {
  if (!count) return 'Nothing for now';
  return count === 1 ? '1 meal' : `${count} meals`;
}

type PushState = { support: 'ok' | 'install' | 'unsupported'; serverReady: boolean; on: boolean; person: string };

export function notificationSummary({ support, serverReady, on, person }: PushState): string {
  if (support === 'install') return 'Add to Home Screen first';
  if (support === 'unsupported') return 'Not available on this device';
  if (!serverReady) return 'Not set up yet';
  if (!on) return 'Off on this phone';
  return person ? `On · ${person}’s phone` : 'On for this phone';
}
