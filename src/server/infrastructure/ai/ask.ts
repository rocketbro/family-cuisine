// One structured-output request, for every Claude call. It is where each call's system prompt gets
// the family's rules (so none can leave them out) and where a call picks the main or the fast model.
//
// The main model sends the server-side fallback beta, so a refusal from a safety classifier on a
// benign request is retried by the API on its recommended model. The fast model (Haiku) has no
// such fallback, so it isn't sent; a refusal there is retried once here, on the main model, with
// the fallback as usual.
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { UserError } from '../../application/user-error.ts';
import { readableApiError } from './errors.ts';
import { withFamilyRules, type RulesUse } from './family-rules.ts';

export type Content = Anthropic.Beta.BetaContentBlockParam[];

/** `fast` is for reading and transcribing work that doesn't need the main model's judgment. */
export type Call = { system: string; rules: RulesUse; fast?: boolean };

type Options = { client: Anthropic | null; model: string; fastModel: string; kitchenNotes: () => string | null };

export function asker({ client, model, fastModel, kitchenNotes }: Options) {
  const send = <S extends z.ZodType>(on: string, fallback: boolean, system: string, content: Content, schema: S) => {
    if (!client) throw new UserError('No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.', 503);
    return client.beta.messages.parse({
      model: on,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: betaZodOutputFormat(schema), effort: 'medium' },
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    }).catch(error => { throw readableApiError(error); });
  };

  return async function ask<S extends z.ZodType>(call: Call, content: Content, schema: S): Promise<z.infer<S>> {
    if (!client) throw new UserError('No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.', 503);
    const system = withFamilyRules(call.system, kitchenNotes(), call.rules);
    const fast = Boolean(call.fast) && fastModel !== model;
    let response = await send(fast ? fastModel : model, !fast, system, content, schema);
    if (fast && response.stop_reason === 'refusal') response = await send(model, true, system, content, schema);
    if (response.stop_reason === 'refusal') throw new UserError('The model declined this request.', 502);
    if (response.stop_reason === 'max_tokens') throw new UserError('The response was cut off; try a smaller input.', 502);
    if (!response.parsed_output) throw new UserError('The model returned something unreadable.', 502);
    return response.parsed_output as z.infer<S>;
  };
}
