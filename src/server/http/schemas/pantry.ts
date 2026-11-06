// Pantry items, and the changes to them that come from the app or a reviewed dictation.
import { z } from 'zod';
import { parseUnit } from '../../../domain/units.ts';
import { isoDate, stockStatus, storage } from './common.ts';

export const portionChange = z.object({
  storage,
  amount: z.number().min(0).nullable(),
  unit: z.string().nullable().transform(u => (u ? parseUnit(u) : null)),
  canOz: z.number().positive().nullable().optional(),
  useBy: isoDate.nullable().optional(),
});

export const pantryFields = z.object({
  name: z.string().min(1),
  category: z.string(),
  status: stockStatus,
  count: z.number().min(0).nullable(),
  staple: z.boolean(),
  store: z.enum(['any', 'aldi', 'walmart']),
  walmartItemId: z.string().regex(/^\d+$/).nullable(),
  minPackages: z.number().int().min(1).max(50),
  packSize: z.object({
    count: z.number().positive().nullable(),
    measure: z.object({ amount: z.number().positive(), unit: z.string().refine(unit => parseUnit(unit) !== null).transform(unit => parseUnit(unit)!) }).nullable(),
  }).nullable(),
  occasional: z.boolean(),
  useBy: isoDate.nullable(),
  lastsDays: z.number().int().min(1).max(730).nullable(),
  portions: z.array(portionChange),
  alsoCalled: z.array(z.string().trim().min(1)),
});

// Worked out by the server from what's stored, unlike `portions`, which say how things should be.
const portionMove = z.object({ from: storage, to: storage, amount: z.number().positive().nullable() });
const stockToAdd = z.object({
  storage,
  amount: z.number().positive().nullable(),
  unit: z.string().nullable().transform(u => (u ? parseUnit(u) : null)),
});

export const pantryPatch = pantryFields.partial().extend({ move: portionMove.optional(), add: stockToAdd.optional() });

export const pantryChange = z.object({
  name: z.string(), status: stockStatus, count: z.number().nullable(), isNew: z.boolean(), category: z.string(), pantryItemId: z.number().nullable(),
  useBy: isoDate.nullable().default(null), lastsDays: z.number().nullable().default(null),
  keepStocked: z.boolean().nullable().default(null), portions: z.array(portionChange).nullable().default(null),
  alsoCalled: z.array(z.string()).nullable().default(null),
});

/** A change as the review sheet showed it, with what the item was at the time. */
export const proposedChange = pantryChange.extend({ current: z.string().nullable() });
