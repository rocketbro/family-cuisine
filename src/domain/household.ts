// Who a household is, in plain words: the one place the app learns the size of the family, when
// they eat and what their people are called. Nothing about any particular family lives in code.

export type HouseholdProfile = {
  /** Who's eating, in plain words. Goes into the prompts as written. Empty until someone says. */
  family: string;
  /** Adult portions a meal should make. Sets batch sizes. */
  portions: number;
  /** Shown beside dinner and given to the planner, as written ("6:30 PM"). */
  dinnerTime: string;
  /** Names to choose from when saying whose phone this is. */
  members: string[];
};

export const DEFAULT_PORTIONS = 4;
const MOST_PORTIONS = 24;
const MOST_MEMBERS = 12;

/** Whatever was stored or sent, made safe to use: anything missing or wrong falls back. */
export function cleanHousehold(input: Partial<Record<keyof HouseholdProfile, unknown>>, fallbackDinnerTime: string): HouseholdProfile {
  const portions = Number(input.portions);
  const members = Array.isArray(input.members) ? input.members.map(name => String(name).trim()).filter(Boolean) : [];
  return {
    family: typeof input.family === 'string' ? input.family.trim() : '',
    portions: Number.isInteger(portions) && portions >= 1 && portions <= MOST_PORTIONS ? portions : DEFAULT_PORTIONS,
    dinnerTime: (typeof input.dinnerTime === 'string' && input.dinnerTime.trim()) || fallbackDinnerTime,
    members: [...new Set(members)].slice(0, MOST_MEMBERS),
  };
}

/** Reads the saved settings value. Nothing saved, or something unreadable, reads as a new household. */
export function readHousehold(stored: string | null, fallbackDinnerTime: string): HouseholdProfile {
  try {
    const parsed: unknown = JSON.parse(stored ?? '{}');
    return cleanHousehold(parsed && typeof parsed === 'object' ? parsed : {}, fallbackDinnerTime);
  } catch {
    return cleanHousehold({}, fallbackDinnerTime);
  }
}

/** A new install asks until someone has said who's eating. */
export function householdIsSetUp(profile: Pick<HouseholdProfile, 'family'>): boolean {
  return profile.family !== '';
}

/** 19:45 becomes "7:45 PM". */
export function clockText({ hour, minute }: { hour: number; minute: number }): string {
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
