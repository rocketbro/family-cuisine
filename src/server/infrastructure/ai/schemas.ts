// Shapes the model must return. Structured outputs guarantee they parse; the use cases
// still validate meaning (real slugs, real dates).
import { z } from 'zod';

const slot = z.enum(['breakfast', 'lunch', 'dinner']);
const recipeMeal = z.enum(['breakfast', 'lunch', 'dinner', 'extra']);

const mealUses = z.array(z.object({
  pantryName: z.string().describe('Exactly one of the pantry names.'),
  text: z.string().describe('How much, as a person would say it, without the item name: "1 loaf", "about 1 lb", "half a bag".'),
  amount: z.number().nullable().describe('How much as a number when it can be measured. Null otherwise.'),
  unit: z.string().nullable().describe('One of: oz, lb, g, kg, cup, tbsp, tsp, quart, can, package. Null when counted ("3 eggs") or anything else.'),
  leaves: z.enum(['have', 'low', 'out']).describe('Where this leaves the item, going by the amounts in the records. "have" when the records can\'t tell you.'),
}));

const NIGHT_BEFORE_FIELD = 'The one step that truly has to happen the evening before cooking, as a few plain words: "Soak the beans overnight". Null for nearly every recipe. Plain text, no links or markup.';

export const RecipeDraftSchema = z.object({
  title: z.string(),
  summary: z.string().describe('One or two warm sentences about the dish. No marketing language.'),
  kind: z.enum(['recipe', 'simple']).describe('"simple" when it is just a list of things to pull out (sandwiches, taco night); "recipe" when there are real steps.'),
  meals: z.array(recipeMeal),
  serves: z.number().describe('Adult portions one batch makes.'),
  time: z.string().nullable().describe('Total time, e.g. "45 min" or "1 hr 15 min".'),
  tags: z.array(z.string()).describe('A few lowercase tags such as soup, baking, freezer-friendly, quick.'),
  batch: z.boolean().describe('True when it is worth doubling on purpose for leftovers (soups, casseroles, chili).'),
  seasons: z.array(z.enum(['spring', 'summer', 'fall', 'winter'])).describe('When a family would want to eat this. All four for anything that suits the whole year, which is most things.'),
  nightBefore: z.string().nullable().describe(NIGHT_BEFORE_FIELD),
  ingredientGroups: z.array(z.object({
    name: z.string().nullable().describe('Sub-heading like "For the dough", or null when there is only one group.'),
    items: z.array(z.object({
      amount: z.string().nullable().describe('As written: "1 1/2", "2-3", "1/4". Null for "to taste".'),
      unit: z.string().nullable().describe('One of: g, kg, oz, lb, ml, l, tsp, tbsp, cup, quart, can, clove, slice, pinch, package. Null when counted ("2 eggs") or anything else; put other measures in the note. "2 (15 oz) cans" is amount 2, unit can, with "15 oz" in the note.'),
      item: z.string().describe('The plain grocery name, matching an existing pantry name when one fits. No prep words here.'),
      note: z.string().nullable().describe('Prep and qualifiers: "finely chopped", "room temperature", "to taste".'),
      optional: z.boolean(),
    })),
  })),
  steps: z.array(z.string()).describe('Each step as one short paragraph. Empty for simple recipes.'),
  notes: z.string().nullable().describe('Tips, storage, variations from the source. Markdown allowed.'),
});

export const RecipeRevisionSchema = z.object({
  understood: z.boolean().describe('False only when you cannot tell what they want changed in this recipe. Then the other fields are ignored.'),
  note: z.string().describe('One short, plain sentence. What you changed, or, when understood is false, what you heard and could not work out.'),
  title: z.string(),
  meals: z.array(recipeMeal),
  serves: z.number().nullable().describe('Adult portions one batch makes. Null when the form has no number there and they did not give one.'),
  time: z.string().nullable().describe('Total time, e.g. "45 min" or "1 hr 15 min". Null when there is none.'),
  nightBefore: z.string().nullable().describe(NIGHT_BEFORE_FIELD),
  summary: z.string(),
  ingredients: z.array(z.string()).describe('One ingredient line each, in the form\'s order, with its group lines in place.'),
  body: z.string().describe('The steps and notes, as markdown.'),
});

export const NightBeforeSchema = z.object({
  steps: z.array(z.object({
    slug: z.string().describe('Exactly one of the recipe slugs given.'),
    step: z.string().describe('A few plain words: "Soak the beans overnight". Plain text, no links or markup.'),
  })).describe('Only the recipes that truly need it. Usually few, and often none.'),
});

export const PlanSchema = z.object({
  meals: z.array(z.object({
    date: z.string().describe('YYYY-MM-DD, one of the dates to plan.'),
    slot,
    kind: z.enum(['recipe', 'leftovers', 'note', 'new']),
    recipeSlug: z.string().nullable().describe('Required when kind is recipe. Must be a slug from the catalog.'),
    multiplier: z.number().describe('Batch multiplier, for the adult portions per meal given in the instructions; 2× a batch recipe to create leftovers.'),
    leftoversOfDate: z.string().nullable().describe('For leftovers: the date of the dinner being eaten again.'),
    note: z.string().nullable().describe('For note: the few words for the fridge list. For new: the name of the dish.'),
    idea: z.string().nullable().describe('For new: one line on what is in it. Null otherwise.'),
  })),
});

export const InterpretationSchema = z.object({
  summary: z.string(),
  pantry: z.array(z.object({
    name: z.string().describe('Existing pantry name when it is the same thing; otherwise a plain new name.'),
    status: z.enum(['have', 'low', 'out']),
    count: z.number().nullable().describe('The new number on hand, for counted items. Null otherwise.'),
    isNew: z.boolean(),
    category: z.string().describe('Produce, Dairy & eggs, Meat, Pantry, Baking, Bread, Frozen, Spices or Other.'),
    useBy: z.string().nullable().describe('YYYY-MM-DD, for a date they said or read off the package, or one week from today when they say it needs using up with no date.'),
    lastsDays: z.number().nullable().describe('Days it usually keeps from today, only for something that goes bad soon and has no stated date.'),
    keepStocked: z.boolean().nullable().describe('True or false only when they said whether they keep it stocked. Null otherwise.'),
    alsoCalled: z.array(z.string()).nullable().describe('Other names a recipe might use for the same thing. Null when there is nothing to add.'),
    portions: z.array(z.object({
      storage: z.enum(['fresh', 'frozen', 'canned', 'dried']).describe('Fresh means kept cold and uncooked; never use it for shelf goods.'),
      amount: z.number().nullable().describe('How much, or null for "some" or a measure not in the unit list. For canned, the number of cans. 0 when this portion is gone.'),
      unit: z.string().nullable().describe('One of: oz, lb, g, kg, cup, quart, can, package. "can" for canned. Null when counted ("3 chicken breasts").'),
      canOz: z.number().nullable().describe('Ounces on each can, for canned ("four 15.5 ounce cans" is amount 4, unit can, canOz 15.5). Null when not said.'),
      useBy: z.string().nullable().describe('YYYY-MM-DD, only for a date they said or read off the package.'),
    })).nullable().describe('Only for raw meat and fish, things kept fresh and frozen, canned goods, and dried beans and lentils. Null for everything else.'),
  })),
  meals: z.array(z.object({
    date: z.string().describe('YYYY-MM-DD, one of the dates in the records.'),
    slot: z.string().describe('breakfast, lunch or dinner, or an extra-N slot exactly as it appears in the records.'),
    outcome: z.enum(['made', 'swapped', 'skipped']),
    recipeSlug: z.string().nullable().describe('For swapped: a slug from the recipe book when it was one of those.'),
    note: z.string().nullable().describe('For swapped to something not in the book: what they ate.'),
    uses: mealUses.nullable().describe('Only for a meal with expectedUses that they say went differently: everything it really used. Null otherwise.'),
  })),
  questions: z.array(z.string()).describe('Up to three short follow-up questions; usually empty.'),
});

export const ReceiptSchema = z.object({
  store: z.enum(['aldi', 'walmart', 'other']),
  purchasedOn: z.string().nullable().describe('YYYY-MM-DD as printed, or null if there is no date.'),
  totalCents: z.number().nullable().describe('The total paid, in cents, exactly as printed. Null if it cannot be read.'),
  lines: z.array(z.object({
    printed: z.string().describe('The product text as printed, abbreviations and all, without the price or quantity.'),
    name: z.string().describe('The product in plain words. The existing pantry name when it is the same thing.'),
    pantryName: z.string().nullable().describe('Exactly one of the pantry names when it is the same thing. Null for something new.'),
    category: z.string().describe('Produce, Dairy & eggs, Meat, Pantry, Baking, Bread, Frozen, Spices or Other.'),
    quantity: z.number().describe('How many were bought; 1 for something sold by weight.'),
    pieces: z.number().nullable().describe('For pantry items marked counted: individual pieces in total (18 for one carton of 18 eggs). Null otherwise or when not printed.'),
    form: z.enum(['fresh', 'canned', 'dried']).nullable().describe('canned for canned goods, dried for dried beans and lentils, fresh for raw meat, poultry or fish sold by weight. Null for everything else.'),
    canOz: z.number().nullable().describe('Ounces per can, only when printed.'),
    weightLb: z.number().nullable().describe('Total pounds, only when printed: a weighed item, or a stated bag size times quantity.'),
    lastsDays: z.number().nullable().describe('For fresh food that goes bad within about a month: days it keeps from today, on the cautious side. Null for everything else.'),
    cents: z.number().nullable().describe('What was paid for this line in cents, exactly as printed, after any discount printed against it. Never estimated: null if it cannot be read.'),
    unsure: z.boolean().describe('True when the printed words leave real doubt about what this is.'),
  })),
});

export const MealPlanSchema = z.object({
  meals: z.array(z.object({
    said: z.string().describe('Their words for this meal, as written or said.'),
    weekday: z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).nullable().describe('The day of the week it names or sits under. Null when no day is given.'),
    date: z.string().nullable().describe('YYYY-MM-DD, only for a calendar date actually written on the plan. Null otherwise: never work one out from a weekday.'),
    slot: z.enum(['breakfast', 'lunch', 'dinner', 'extra']).describe('Which meal. "extra" is something on top of the day\'s meals, like a birthday cake.'),
    kind: z.enum(['recipe', 'named', 'leftovers']),
    recipeSlug: z.string().nullable().describe('For recipe: exactly one of the slugs in the recipe book. Null otherwise.'),
    name: z.string().nullable().describe('For named: the meal in a few plain words. Null otherwise.'),
    confidence: z.enum(['sure', 'likely', 'unsure']).describe('How sure you are of the day, the meal and the match taken together.'),
  })),
});

export const PantryMealSchema = z.object({
  title: z.string().describe('A few words a family would write on the fridge: "Baked chicken, broccoli and garlic bread".'),
  why: z.string().describe('One short line on why this meal now, naming what it uses up if anything.'),
  how: z.string().nullable().describe('One or two short sentences, under 35 words, on getting it all on the table at once. The family knows how to cook. Null when a recipe covers all of it.'),
  recipeSlug: z.string().nullable().describe('The recipe it is built on, from the list. Null when it is just things thrown together.'),
  multiplier: z.number().describe('Batch size of that recipe for the adult portions given in the instructions; 1 when there is no recipe.'),
  uses: mealUses.describe('What this takes from the pantry, sized for the whole family. With a recipe, only what the recipe does not already call for.'),
});
