// Input checking at the edge: bad requests become a 4xx with a readable message.
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

/** A cross-site form can post text/plain with no preflight, so a JSON body has to say it's JSON. */
export const isJsonRequest = (contentType: string | undefined) => /^application\/json\s*(;|$)/i.test(contentType ?? '');
export const isMultipartRequest = (contentType: string | undefined) => /^multipart\/form-data\s*;/i.test(contentType ?? '');

export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  if (!isJsonRequest(c.req.header('content-type'))) throw new HTTPException(415, { message: 'This needs to be sent as JSON.' });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  return parsed.data;
}

export function param<S extends z.ZodType>(value: string | undefined, schema: S): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HTTPException(400, { message: `bad parameter: ${value}` });
  return parsed.data;
}

/** Reads uploaded files from a multipart form. */
export async function files(c: Context, field: string, max = 20): Promise<{ name: string; data: Buffer }[]> {
  if (!isMultipartRequest(c.req.header('content-type'))) throw new HTTPException(415, { message: 'This needs to be sent as a file upload.' });
  const form = await c.req.parseBody({ all: true });
  const raw = form[field];
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(item => item instanceof File);
  if (list.length > max) throw new HTTPException(413, { message: `That's too many files at once (${max} at most).` });
  return Promise.all(list.map(async item => ({ name: item.name, data: Buffer.from(await item.arrayBuffer()) })));
}

export async function formText(c: Context, field: string): Promise<string | null> {
  const value = (await c.req.parseBody())[field];
  return typeof value === 'string' ? value : null;
}
