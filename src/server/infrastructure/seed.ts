// First run only: staples and a few starter recipes, so a new install has something to plan with.
// A marker in the database means this happens once. An install with anything in it already counts
// as started, so it gets the marker and nothing else, and emptying the pantry or deleting every
// recipe later never brings the samples back.
import fs from 'node:fs';
import path from 'node:path';
import type { HouseholdRepository } from '../application/ports/household.ts';
import type { PantryInput, PantryRepository } from '../application/ports/pantry.ts';
import type { PlanRepository } from '../application/ports/plan.ts';
import type { RecipeRepository } from '../application/ports/recipes.ts';

const MARKER = 'first_run_done';

type SeedOptions = {
  seedDir: string;
  recipesDir: string;
  pantry: Pick<PantryRepository, 'list' | 'create'>;
  recipes: Pick<RecipeRepository, 'list'>;
  plan: Pick<PlanRepository, 'range'>;
  household: Pick<HouseholdRepository, 'setting' | 'saveSetting'>;
  log: (m: string) => void;
};

export function seedFirstRun(opts: SeedOptions): void {
  if (opts.household.setting(MARKER)) return;
  const brandNew = !opts.pantry.list().length && !opts.recipes.list().length && !opts.plan.range('0000-01-01', '9999-12-31').length;
  if (brandNew) {
    seedPantry(opts);
    seedRecipes(opts);
  }
  opts.household.saveSetting(MARKER, new Date().toISOString());
}

function seedPantry({ seedDir, pantry, log }: SeedOptions): void {
  const file = path.join(seedDir, 'pantry.json');
  if (!fs.existsSync(file)) return;
  for (const item of JSON.parse(fs.readFileSync(file, 'utf8')) as PantryInput[]) pantry.create(item);
  log('added the pantry staples');
}

function seedRecipes({ seedDir, recipesDir, log }: SeedOptions): void {
  const dir = path.join(seedDir, 'recipes');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.md'));
  fs.mkdirSync(recipesDir, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(dir, file), path.join(recipesDir, file), fs.constants.COPYFILE_EXCL);
  log(`added ${files.length} starter recipes`);
}
