// Where someone was when they started talking.
import { z } from 'zod';
import { isoDate, planSlot } from './common.ts';

export const listenContext = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anywhere') }),
  z.object({ kind: z.literal('pantry'), answering: z.array(z.string()).max(5).optional() }),
  z.object({ kind: z.literal('checkin'), date: isoDate }),
  z.object({ kind: z.literal('cooked'), date: isoDate, slot: planSlot, slug: z.string(), factor: z.number().positive(), substituted: z.record(z.string().regex(/^\d+$/), z.string()).optional() }),
]);
