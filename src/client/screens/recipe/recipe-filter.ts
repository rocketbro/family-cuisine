// Which recipes the Recipes list shows, given the search, the chosen filter and Claude's picks.
import type { RecipeMeal } from '../../../domain/recipe.ts';

export type RecipeFilter = RecipeMeal | 'all' | 'ready';
export type ClaudeView = 'show' | 'hide' | 'only';
type Choices = { query: string; filter: RecipeFilter; claude: ClaudeView };
type Listed = {
  title: string; tags: readonly string[]; meals: readonly RecipeMeal[]; claudesPick: boolean;
  availability: { level: string };
};

export function recipeShows(recipe: Listed, { query, filter, claude }: Choices): boolean {
  const searched = `${recipe.title} ${recipe.tags.join(' ')}`.toLowerCase();
  if (query && !searched.includes(query.toLowerCase())) return false;
  if (claude === 'hide' && recipe.claudesPick) return false;
  if (claude === 'only' && !recipe.claudesPick) return false;
  if (filter === 'ready') return recipe.availability.level === 'ready';
  return filter === 'all' || recipe.meals.includes(filter);
}
