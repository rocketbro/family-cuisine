// What a failure says to the person using the app. Only messages written for them go out; the
// rest (which can hold paths and internals) stay in the log.
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { UserError } from '../application/user-error.ts';

export const GENERIC_ERROR = 'Something went wrong on the server. Try again, and check its log if it keeps happening.';

export function errorResponse(error: Error, c: Context, log: (message: string) => void) {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  const place = `${c.req.method} ${c.req.path}`;
  if (error instanceof UserError) {
    if (error.status >= 500) log(`on ${place}: ${error.message}${error.cause ? ` (${(error.cause as Error).message})` : ''}`);
    return c.json({ error: error.message, ...(error.code && { code: error.code }) }, error.status as ContentfulStatusCode);
  }
  log(`error on ${place}: ${error.stack ?? error.message}`);
  return c.json({ error: GENERIC_ERROR }, 500);
}
