// What each screen's first-visit tip says. Copy only: which screen shows which tip is in
// `tip-route.ts`, and whether it has been seen is in `tip-memory.ts`.
// Bump a tip's `version` when what it says changes enough that people should see it again.

export type TipId =
  | 'today' | 'plan' | 'plan-import' | 'list' | 'receipt' | 'pantry'
  | 'recipes' | 'recipe-import' | 'recipe' | 'checkin' | 'how-we-cook';

export type Tip = { version: number; title: string; bullets: readonly string[] };

export const TIPS: Record<TipId, Tip> = {
  today: {
    version: 1,
    title: 'Today’s meals',
    bullets: [
      'Swipe a meal toward its check mark to check it off. Swipe the other way to swap it.',
      'Checking off asks if you still have its ingredients, and if dinner has any left.',
      'The evening check-in only comes if something is still unanswered.',
      'A meal taken off for a missing ingredient leaves a note: Put back on the plan, or ×.',
    ],
  },
  plan: {
    version: 1,
    title: 'The plan',
    bullets: [
      'One screen is one shopping trip. The arrows move between trips.',
      'Tap a day to open it. The plus adds an extra: anything else you’ll make that day.',
      'Save money compares whole shopping lists. Nothing changes until you confirm.',
      'Import a meal plan reads a photo or words you already wrote.',
    ],
  },
  'plan-import': {
    version: 1,
    title: 'Importing a plan',
    bullets: [
      'Choose the days first, then add a photo or words. A partial plan is fine.',
      'Claude reads it in order, so a Saturday that comes round again is the next Saturday.',
      'A meal with no recipe stays a name. Nothing saves until you confirm.',
    ],
  },
  list: {
    version: 1,
    title: 'The grocery list',
    bullets: [
      'Tap a name. Have it updates the pantry. Not this trip only skips it for now.',
      'Tick things as you shop. Put away then adds them to the pantry.',
      'Over budget? Choose what to skip appears under the total.',
      'Add something is for this trip only. A receipt, at the bottom, updates the pantry.',
    ],
  },
  receipt: {
    version: 1,
    title: 'Checking a receipt',
    bullets: [
      'Fix a name, or untick a line that shouldn’t go in the pantry.',
      'Never add this, on an unticked line, skips it on every later receipt.',
      'Prices only keeps the prices and leaves the pantry and list alone.',
      'Tell Claude what to change fixes rows by voice or typing. Nothing saves until you do.',
    ],
  },
  pantry: {
    version: 1,
    title: 'The pantry',
    bullets: [
      'Tap an item to set Have, Low or Out. That builds the grocery list.',
      'Keep stocked and Always on hand are under See all, on an open item.',
      'Other names lets a recipe’s “jam” find your raspberry preserves.',
    ],
  },
  recipes: {
    version: 1,
    title: 'Your recipes',
    bullets: [
      'Can make now shows only what the pantry covers.',
      'The plus adds a recipe from a link, photos or a description.',
      'The Claude chip hides or shows dishes Claude invented that you haven’t kept.',
    ],
  },
  'recipe-import': {
    version: 1,
    title: 'Adding a recipe',
    bullets: [
      'Claude writes it up from a link, photos or your own words.',
      'Ingredients are matched to pantry items, and other names it uses are learned.',
      'Your How we cook rules apply. Fix anything afterwards from Edit or delete.',
    ],
  },
  recipe: {
    version: 1,
    title: 'Cooking this',
    bullets: [
      'Cooking mode keeps the screen awake. Done, top right, leaves it. It records nothing.',
      'Batch size rescales the ingredients. See substitutes cooks with a stand-in.',
      'Edit or delete, at the bottom, has Tell Claude: say what to change.',
    ],
  },
  checkin: {
    version: 1,
    title: 'Evening check-in',
    bullets: [
      'It only asks about what is still unanswered.',
      'Mark each meal Made, Skipped or Something else.',
      'Then it asks what the meals used up, so the pantry stays right.',
    ],
  },
  'how-we-cook': {
    version: 1,
    title: 'How we cook',
    bullets: [
      'These rules go to Claude with every request.',
      'Write them the way you’d say them, including what you call things.',
      'Recipe imports match ingredients to pantry items and learn the other names.',
      'Recipes you already have don’t change.',
    ],
  },
};
