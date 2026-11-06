// The small words every area's requests are made of.
import { z } from 'zod';
import { isRealDate } from '../../../domain/dates.ts';
import { isPlanSlot, type PlanSlot } from '../../../domain/plan-slot.ts';

export const isoDate = z.string().refine(isRealDate, 'not a real date');
export const slot = z.enum(['breakfast', 'lunch', 'dinner']);
/** Any slot a meal can already be in, extras too. Choosing what goes in a meal's slot still takes `slot`. */
export const planSlot = z.custom<PlanSlot>(value => typeof value === 'string' && isPlanSlot(value));
export const stockStatus = z.enum(['have', 'low', 'out']);
export const storage = z.enum(['fresh', 'frozen', 'canned', 'dried']);
/** A store a list line or a price can belong to. A pantry item's preference can also be `any`. */
export const store = z.enum(['aldi', 'walmart']);
