// The one place that talks to Claude. Each call is a single structured-output request:
// no agent loop, just "here is the material, return this shape".
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { weekdayName } from '../../../domain/dates.ts';
import type { HouseholdProfile } from '../../../domain/household.ts';
import { parseIngredientLine, type Ingredient } from '../../../domain/ingredient.ts';
import { cleanNightBefore } from '../../../domain/night-before.ts';
import { isPlanSlot } from '../../../domain/plan-slot.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import type { PantryMatch } from '../../../domain/pantry-other-names.ts';
import type { RecipeDraft } from '../../application/ports/recipes.ts';
import { asker, type Content } from './ask.ts';
import { pantryList } from './pantry-list.ts';
import { PAGE_IMPORT_PROMPT, pageImportText } from './page-import.ts';
import {
  listenPrompt, MEAL_PLAN_PROMPT, REVISE_MEAL_PLAN_PROMPT, NIGHT_BEFORE_PROMPT, pantryMealPrompt, plannerPrompt, RECEIPT_PROMPT, RECIPE_PROMPT,
  REVISE_RECEIPT_PROMPT, REVISE_RECIPE_PROMPT, writeRecipePrompt,
} from './prompts.ts';
import {
  InterpretationSchema, MealPlanRevisionSchema, MealPlanSchema, NightBeforeSchema, PantryMealSchema, PlanSchema, ReceiptRevisionSchema, ReceiptSchema,
  RecipeDraftSchema, RecipeRevisionSchema,
} from './schemas.ts';

type Options = { apiKey: string | null; model: string; fastModel: string; kitchenNotes: () => string | null; household: () => HouseholdProfile };

export function claudeAi({ apiKey, model, fastModel, kitchenNotes, household }: Options): AiPort {
  const client = apiKey ? new Anthropic({ apiKey }) : null;
  const ask = asker({ client, model, fastModel, kitchenNotes });

  const ourWay = (notes: string | null) => notes?.trim() ? `\n\nHow we make it (from the family; this wins over the source):\n"""${notes.trim()}"""` : '';

  return {
    available: () => client !== null,

    async planMeals(context) {
      const result = await ask({ system: plannerPrompt(household()), rules: 'write' }, [{ type: 'text', text: JSON.stringify(context, null, 1) }], PlanSchema);
      return result.meals;
    },

    async recipeFromImages(images, pantry, notes) {
      const content: Content = [
        ...images.map(image => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } })),
        { type: 'text', text: `These are photos of one recipe, in page order. Transcribe it faithfully.\n\n${pantryList(pantry)}${ourWay(notes)}` },
      ];
      return toDraft(await ask({ system: RECIPE_PROMPT, rules: 'write', fast: true }, content, RecipeDraftSchema));
    },

    async recipeFromPage(page, pantry, notes) {
      return toDraft(await ask({ system: PAGE_IMPORT_PROMPT, rules: 'write', fast: true }, [{ type: 'text', text: pageImportText(page, pantry, notes) }], RecipeDraftSchema));
    },

    async recipeFromDescription(description, pantry, { invented = false } = {}) {
      const text = `${pantryList(pantry)}\n\nWrite up this recipe:\n"""${description.trim()}"""`;
      return toDraft(await ask({ system: writeRecipePrompt(household()), rules: 'write', fast: !invented }, [{ type: 'text', text }], RecipeDraftSchema));
    },

    async readReceipt(files, context) {
      const content: Content = [
        ...files.map(file => (file.mediaType === 'application/pdf'
          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: file.mediaType, data: file.data } }
          : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.mediaType, data: file.data } })),
        { type: 'text', text: `Today is ${context.today}. Read this receipt.\n\nThe shopping list they went in with:\n${context.list ? JSON.stringify(context.list) : '(no list was saved)'}\n\nPantry:\n${JSON.stringify(context.pantry)}` },
      ];
      return ask({ system: RECEIPT_PROMPT, rules: 'read' }, content, ReceiptSchema);
    },

    async reviseReceipt({ said, ...receipt }) {
      const text = `The receipt as it stands on their screen, and what they can choose from:\n${JSON.stringify(receipt, null, 1)}\n\nWhat they said or typed (speech-to-text, so expect mistakes):\n"""${said}"""`;
      return ask({ system: REVISE_RECEIPT_PROMPT, rules: 'read' }, [{ type: 'text', text }], ReceiptRevisionSchema);
    },

    async draftMeal(context) {
      return ask({ system: pantryMealPrompt(household()), rules: 'write' }, [{ type: 'text', text: JSON.stringify(context, null, 1) }], PantryMealSchema);
    },

    async readMealPlan(plan, context) {
      const content: Content = [
        ...plan.images.map(image => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } })),
        { type: 'text', text: `Today is ${context.today}. They're planning ${weekdayName(context.range.from)} ${context.range.from} through ${weekdayName(context.range.through)} ${context.range.through}.\n\nThe recipe book:\n${JSON.stringify(context.recipes)}\n\n${plan.images.length ? 'The plan is in the photos above, in page order.' : ''}${plan.text ? `\n\nThe plan, as they wrote or said it:\n"""${plan.text}"""` : ''}` },
      ];
      return (await ask({ system: MEAL_PLAN_PROMPT, rules: 'read' }, content, MealPlanSchema)).meals;
    },

    async revisePlan({ said, onDate, meals, today, recipes }) {
      const text = `Today is ${today}, a ${weekdayName(today)}. The day on their screen: ${onDate ? `${weekdayName(onDate)} ${onDate}` : 'the page of meals with no day'}.\n\nThe recipe book:\n${JSON.stringify(recipes)}\n\nThe plan as it stands:\n${JSON.stringify(meals, null, 1)}\n\nWhat they said (speech-to-text, so expect mistakes):\n"""${said}"""`;
      return ask({ system: REVISE_MEAL_PLAN_PROMPT, rules: 'read' }, [{ type: 'text', text }], MealPlanRevisionSchema);
    },

    async interpret(request) {
      const { said, situation, ...records } = request;
      const text = `${situation}\n\nRecords:\n${JSON.stringify(records, null, 1)}\n\nWhat they said (speech-to-text, so expect mistakes):\n"""${said || '(nothing; they confirmed it went as written)'}"""`;
      const result = await ask({ system: listenPrompt(household()), rules: 'read' }, [{ type: 'text', text }], InterpretationSchema);
      return { ...result, meals: result.meals.flatMap(meal => (isPlanSlot(meal.slot) ? [{ ...meal, slot: meal.slot }] : [])) };
    },

    // The recipes' text may have come from web pages, so it's fenced off as material; the family's rules still apply.
    async nightBeforeSteps(recipes) {
      return (await ask({ system: NIGHT_BEFORE_PROMPT, rules: 'write', fast: true }, [{ type: 'text', text: JSON.stringify(recipes) }], NightBeforeSchema)).steps;
    },

    async reviseRecipe({ said, form, pantry }) {
      const contents = { ...form, ingredients: form.ingredients.split('\n').filter(line => line.trim()) };
      const text = `${pantryList(pantry)}\n\nThe form as it stands:\n${JSON.stringify(contents, null, 1)}\n\nWhat they said (speech-to-text, so expect mistakes):\n"""${said}"""`;
      return ask({ system: REVISE_RECIPE_PROMPT, rules: 'write' }, [{ type: 'text', text }], RecipeRevisionSchema);
    },
  };
}

function toDraft(result: z.infer<typeof RecipeDraftSchema>): RecipeDraft {
  const pantryMatches: PantryMatch[] = result.ingredientGroups.flatMap(group =>
    group.items.flatMap(item => (item.pantryName?.trim() ? [{ written: item.item, pantryName: item.pantryName }] : [])));
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
    pantryMatches,
  };
}
