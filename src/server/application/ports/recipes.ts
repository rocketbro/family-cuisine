import type { Ingredient } from '../../../domain/ingredient.ts';
import type { RecipeEdit } from '../../../domain/recipe-edit.ts';
import type { RecipeFileProblem } from '../../../domain/recipe-file-problem.ts';
import type { Recipe, RecipeMeal, RecipeImage, RecipeKind, RecipeSource } from '../../../domain/recipe.ts';
import type { Season } from '../../../domain/seasons.ts';

export type RecipeRepository = {
  list(): Recipe[];
  /** Files in the recipe folder that list() had to leave out, and why. Only names, never paths. */
  problems(): RecipeFileProblem[];
  get(slug: string): Recipe | null;
  /** Writes the canonical markdown file; returns the slug actually used. */
  save(draft: RecipeDraft, slug?: string): string;
  setImage(slug: string, image: RecipeImage | null): void;
  setSeasons(slug: string, seasons: readonly Season[]): void;
  /** Adds a night-before step, changing nothing else in the file. False, and no change, if the header already says anything about one. */
  addNightBefore(slug: string, step: string): boolean;
  /** Rewrites what a person can edit; the slug, photo, source, tags and seasons stay. */
  update(slug: string, edit: RecipeEdit): void;
  /** A Claude's pick joins the family's regular recipes. */
  keepPick(slug: string): void;
  remove(slug: string): void;
};

/** A recipe as an import or the model produces it, before it becomes a file. */
export type RecipeDraft = {
  title: string;
  kind: RecipeKind;
  meals: RecipeMeal[];
  serves: number;
  time: string | null;
  tags: string[];
  batch: boolean;
  seasons: Season[];
  source: RecipeSource | null;
  image: RecipeImage | null;
  summary: string;
  ingredients: Ingredient[];
  steps: string[];
  notes: string | null;
  claudesPick?: boolean;
  nightBefore?: string | null;
};
