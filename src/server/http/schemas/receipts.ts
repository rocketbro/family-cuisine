// What the receipt review sends: its choices on Save, and its rows when asking Claude to change them.
import { z } from 'zod';

const index = z.number().int().min(0);
const name = z.string().max(200);
const named = z.array(z.object({ index, name })).max(500);
const listKey = z.string().min(1).max(300);

export const receiptChoices = z.object({
  kept: named,
  neverAdd: named.default([]),
  substitutes: z.array(z.object({ index, listKey, always: z.boolean() })).max(500).default([]),
  pricesOnly: z.boolean().default(false),
});

export const receiptRevision = z.object({
  said: z.string().max(20_000),
  rows: z.array(z.object({
    index, name, included: z.boolean(), neverAdd: z.boolean(), leftOut: z.boolean(), insteadOf: listKey.nullable(), always: z.boolean(),
  })).max(500),
});
