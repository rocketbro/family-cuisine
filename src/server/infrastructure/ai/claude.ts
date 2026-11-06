// The one place that talks to Claude. Each call is a single structured-output request:
// no agent loop, just "here is the material, return this shape".
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { HouseholdProfile } from '../../../domain/household.ts';
import { parseIngredientLine, type Ingredient } from '../../../domain/ingredient.ts';
import { cleanNightBefore } from '../../../domain/night-before.ts';
import { isPlanSlot } from '../../../domain/plan-slot.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import type { RecipeDraft } from '../../application/ports/recipes.ts';
import { UserError } from '../../application/user-error.ts';
import { readableApiError } from './errors.ts';
import { PAGE_IMPORT_PROMPT, pageImportText } from './page-import.ts';
import { listenPrompt, MEAL_PLAN_PROMPT, NIGHT_BEFORE_PROMPT, pantryMealPrompt, plannerPrompt, RECEIPT_PROMPT, RECIPE_PROMPT, REVISE_RECIPE_PROMPT, withCookingRules, withTheirWords, writeRecipePrompt } from './prompts.ts';
import { InterpretationSchema, MealPlanSchema, NightBeforeSchema, PantryMealSchema, PlanSchema, ReceiptSchema, RecipeDraftSchema, RecipeRevisionSchema } from './schemas.ts';

type Content = Anthropic.Beta.BetaContentBlockParam[];

type Options = { apiKey: string | null; model: string; kitchenNotes: () => string | null; household: () => HouseholdProfile };

export function claudeAi({ apiKey, model, kitchenNotes, household }: Options): AiPort {
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  /** Anything that decides what gets cooked or how it's written follows the family's standing rules. */
  const inTheirKitchen = (prompt: string) => withCookingRules(prompt, kitchenNotes());

  async function ask<S extends z.ZodType>(system: string, content: Content, schema: S): Promise<z.infer<S>> {
    if (!client) throw new UserError('No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.', 503);
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: betaZodOutputFormat(schema), effort: 'medium' },
      // If a safety classifier declines a benign request, the API retries on its recommended model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }).catch(error => { throw readableApiError(error); });
    if (response.stop_reason === 'refusal') throw new UserError('The model declined this request.', 502);
    if (response.stop_reason === 'max_tokens') throw new UserError('The response was cut off; try a smaller input.', 502);
    if (!response.parsed_output) throw new UserError('The model returned something unreadable.', 502);
    return response.parsed_output as z.infer<S>;
  }

  const ourWay = (notes: string | null) => notes?.trim() ? `\n\nHow we make it (from the family; this wins over the source):\n"""${notes.trim()}"""` : '';
  const pantryList = (names: string[]) => `Existing pantry names (reuse these exactly when they fit):\n${names.join(', ') || '(none yet)'}`;

  return {
    available: () => client !== null,

    async planMeals(context) {
      const result = await ask(inTheirKitchen(plannerPrompt(household())), [{ type: 'text', text: JSON.stringify(context, null, 1) }], PlanSchema);
      return result.meals;
    },

    async recipeFromImages(images, pantryNames, notes) {
      const content: Content = [
        ...images.map(image => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } })),
        { type: 'text', text: `These are photos of one recipe, in page order. Transcribe it faithfully.\n\n${pantryList(pantryNames)}${ourWay(notes)}` },
      ];
      return toDraft(await ask(inTheirKitchen(RECIPE_PROMPT), content, RecipeDraftSchema));
    },

    async recipeFromPage(page, notes) {
      return toDraft(await ask(PAGE_IMPORT_PROMPT, [{ type: 'text', text: pageImportText(page, notes) }], RecipeDraftSchema));
    },

    async recipeFromDescription(description, pantryNames) {
      const text = `${pantryList(pantryNames)}\n\nWrite up this recipe:\n"""${description.trim()}"""`;
      return toDraft(await ask(inTheirKitchen(writeRecipePrompt(household())), [{ type: 'text', text }], RecipeDraftSchema));
    },

    async readReceipt(files, context) {
      const content: Content = [
        ...files.map(file => (file.mediaType === 'application/pdf'
          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: file.mediaType, data: file.data } }
          : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.mediaType, data: file.data } })),
        { type: 'text', text: `Today is ${context.today}. Read this receipt.\n\nThe shopping list they went in with:\n${context.list ? JSON.stringify(context.list) : '(no list was saved)'}\n\nPantry:\n${JSON.stringify(context.pantry)}` },
      ];
      return ask(RECEIPT_PROMPT, content, ReceiptSchema);
    },

    async draftMeal(context) {
      return ask(inTheirKitchen(pantryMealPrompt(household())), [{ type: 'text', text: JSON.stringify(context, null, 1) }], PantryMealSchema);
    },

    async readMealPlan(plan, context) {
      const content: Content = [
        ...plan.images.map(image => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } })),
        { type: 'text', text: `Today is ${context.today}.\n\nThe recipe book:\n${JSON.stringify(context.recipes)}\n\n${plan.images.length ? 'The plan is in the photos above, in page order.' : ''}${plan.text ? `\n\nThe plan, as they wrote or said it:\n"""${plan.text}"""` : ''}` },
      ];
      return (await ask(withTheirWords(MEAL_PLAN_PROMPT, kitchenNotes()), content, MealPlanSchema)).meals;
    },

    async interpret(request) {
      const { said, situation, ...records } = request;
      const text = `${situation}\n\nRecords:\n${JSON.stringify(records, null, 1)}\n\nWhat they said (speech-to-text, so expect mistakes):\n"""${said || '(nothing; they confirmed it went as written)'}"""`;
      const result = await ask(withTheirWords(listenPrompt(household()), kitchenNotes()), [{ type: 'text', text }], InterpretationSchema);
      return { ...result, meals: result.meals.flatMap(meal => (isPlanSlot(meal.slot) ? [{ ...meal, slot: meal.slot }] : [])) };
    },

    // Recipes may have come from web pages, so this gets nothing private: no kitchen notes, no household, no pantry.
    async nightBeforeSteps(recipes) {
      return (await ask(NIGHT_BEFORE_PROMPT, [{ type: 'text', text: JSON.stringify(recipes) }], NightBeforeSchema)).steps;
    },

    async reviseRecipe({ said, form, pantryNames }) {
      const contents = { ...form, ingredients: form.ingredients.split('\n').filter(line => line.trim()) };
      const text = `${pantryList(pantryNames)}\n\nThe form as it stands:\n${JSON.stringify(contents, null, 1)}\n\nWhat they said (speech-to-text, so expect mistakes):\n"""${said}"""`;
      return ask(inTheirKitchen(REVISE_RECIPE_PROMPT), [{ type: 'text', text }], RecipeRevisionSchema);
    },
  };
}

function toDraft(result: z.infer<typeof RecipeDraftSchema>): RecipeDraft {
  const ingredients: Ingredient[] = result.ingredientGroups.flatMap(group =>
    group.items
      .map(item => {
        const line = [item.amount, item.unit, item.item].filter(Boolean).join(' ') + (item.note ? `, ${item.note}` : '') + (item.optional ? ' (optional)' : '');
        return parseIngredientLine(line, group.name);
      })
      .filter((i): i is Ingredient => i !== null),
  );
  return {
    title: result.title, kind: result.kind, meals: result.meals.length ? result.meals : ['extra'], serves: result.serves || 4,
    time: result.time, tags: result.tags, batch: result.batch, seasons: result.seasons, source: null, image: null,
    summary: result.summary, ingredients, steps: result.steps, notes: result.notes,
    // Whatever the source was, what lands here is a short line of plain words or nothing.
    nightBefore: cleanNightBefore(result.nightBefore),
  };
}
