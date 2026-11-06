// Where a recipe's picture lives, at the size wanted.
import type { RecipeImage } from '../../domain/recipe.ts';

export function imageUrl(image: RecipeImage | null, size: 'thumb' | 'full'): string | null {
  if (!image) return null;
  if (image.kind === 'photo') return `/media/${image.file}`;
  return size === 'thumb' ? image.thumbUrl : image.url;
}
