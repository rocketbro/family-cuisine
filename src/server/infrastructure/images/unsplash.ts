// Real food photos for recipes that don't have one of the family's own yet. Per Unsplash's
// API guidelines: hotlink their URLs, credit the photographer with a link, and ping the
// download endpoint when a photo is chosen.
import type { RecipeImage } from '../../../domain/recipe.ts';
import type { ImageSearchPort } from '../../application/ports/images.ts';
import { isTrustedImageUrl } from '../../../domain/image-source.ts';

type Photo = {
  urls: { regular: string; small: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

const UTM = 'utm_source=cuisine&utm_medium=referral';
const SEARCH_SIZE = 10;

export function unsplashImages(accessKey: string | null): ImageSearchPort {
  const headers = { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' };
  return {
    available: () => accessKey !== null,
    async find(title, replacing) {
      if (!accessKey) return null;
      let photo: Photo | undefined;
      // Specific titles ("Farmhouse Chicken Noodle Soup") often find nothing; drop words from the front.
      for (const query of broaderQueries(title)) {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(`${query} food`)}&per_page=${SEARCH_SIZE}&orientation=landscape&content_filter=high`;
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Unsplash search failed (HTTP ${response.status})`);
        const results = ((await response.json()) as { results: Photo[] }).results;
        // Only the host the Content-Security-Policy allows; Unsplash+ photos live elsewhere.
        const others = results.filter(result => result.urls.regular !== replacing && isTrustedImageUrl(result.urls.regular));
        // Looking again should land somewhere new, not just on the next one and back.
        photo = replacing ? others[Math.floor(Math.random() * others.length)] : others[0];
        if (photo) break;
      }
      if (!photo) return null;
      void fetch(photo.links.download_location, { headers }).catch(() => {});
      return {
        kind: 'unsplash',
        url: photo.urls.regular,
        thumbUrl: photo.urls.small,
        credit: photo.user.name,
        creditUrl: `${photo.user.links.html}?${UTM}`,
      } satisfies RecipeImage;
    },
  };
}

function broaderQueries(title: string): string[] {
  const words = title.replace(/[&,]/g, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length && words.length - i >= 2; i++) out.push(words.slice(i).join(' '));
  return out.length ? out : [title];
}
