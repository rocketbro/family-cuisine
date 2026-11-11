// One structured-output request, for every Claude call. It is where each call's system prompt gets
// the family's rules, so none can leave them out. The server-side fallback beta means a refusal
// from a safety classifier on a benign request is retried by the API on its recommended model.
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { UserError } from '../../application/user-error.ts';
import { readableApiError } from './errors.ts';
import { withFamilyRules, type RulesUse } from './family-rules.ts';

export type Content = Anthropic.Beta.BetaContentBlockParam[];

export type Call = { system: string; rules: RulesUse };

type Options = { client: Anthropic | null; model: string; kitchenNotes: () => string | null };

export function asker({ client, model, kitchenNotes }: Options) {
  return async function ask<S extends z.ZodType>(call: Call, content: Content, schema: S): Promise<z.infer<S>> {
    if (!client) throw new UserError('No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.', 503);
    const system = withFamilyRules(call.system, kitchenNotes(), call.rules);
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: betaZodOutputFormat(schema), effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }).catch(error => { throw readableApiError(error); });
    if (response.stop_reason === 'refusal') throw new UserError('The model declined this request.', 502);
    if (response.stop_reason === 'max_tokens') throw new UserError('The response was cut off; try a smaller input.', 502);
    if (!response.parsed_output) throw new UserError('The model returned something unreadable.', 502);
    return response.parsed_output as z.infer<S>;
  };
}
