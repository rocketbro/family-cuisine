// Turns API failures into sentences someone can act on, instead of raw JSON on a phone screen.
// The full error still goes to the log through the HTTP error handler.
import Anthropic from '@anthropic-ai/sdk';
import { UserError } from '../../application/user-error.ts';

export function readableApiError(error: unknown): Error {
  if (!(error instanceof Anthropic.APIError)) return error instanceof Error ? error : new Error(String(error));
  const detail = (error.error as { error?: { message?: string } } | undefined)?.error?.message ?? error.message;
  const said = (sentence: string, status = 503) => Object.assign(new UserError(sentence, status), { cause: error });

  if (error instanceof Anthropic.APIConnectionError) return said('Couldn’t reach Claude. Check the server’s internet connection and try again.');
  if (/credit balance/i.test(detail)) return said('The Anthropic account is out of credits. Add some under Plans & Billing, then try again.');
  if (error.status === 401) return said('Claude didn’t accept the API key. Check ANTHROPIC_API_KEY in .env.');
  if (error.status === 403) return said('This API key isn’t allowed to do that.');
  if (error.status === 429) return said('Claude is busy right now. Try again in a minute.', 429);
  if (error.status === 529 || (error.status ?? 0) >= 500) return said('Claude is having trouble right now. Try again in a minute.');
  return said(`Claude couldn’t do that: ${detail}`, 502);
}
