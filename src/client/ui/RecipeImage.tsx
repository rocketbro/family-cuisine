// A recipe's picture: the family's own photo, an Unsplash photo, or a quiet initial.
import type { RecipeImage as Image } from '../../domain/recipe.ts';
import { imageUrl } from './image-url.ts';

export function RecipeImage({ image, title, size }: { image: Image | null; title: string; size: 'thumb' | 'full' }) {
  const url = imageUrl(image, size);
  if (!url) return <div className="placeholder-art" style={{ fontSize: size === 'thumb' ? '1.8rem' : '4rem' }}>{title.charAt(0)}</div>;
  return <img src={url} alt="" loading="lazy" />;
}
