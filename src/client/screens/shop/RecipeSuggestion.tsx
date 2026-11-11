// Something said on a receipt that's really about a recipe. Recipes aren't changed from here: the
// link opens that recipe's editor with the words ready to hand to Claude.
import { BookOpen } from 'lucide-react';
import { TabLink } from '../../navigation/TabLink.tsx';

export function RecipeSuggestion({ slug, title, said }: { slug: string; title: string; said: string }) {
  return (
    <p className="revision-note recipe-suggestion">
      <BookOpen size={16} aria-hidden="true" />
      <span className="grow">
        That sounds like {title}.{' '}
        <TabLink to={`/recipes/${encodeURIComponent(slug)}?tell=${encodeURIComponent(said)}`}>Change the recipe</TabLink>
      </span>
    </p>
  );
}
