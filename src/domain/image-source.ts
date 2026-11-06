// Where a picture in the app may come from. Recipe text can come from a hostile page, and loading
// a picture from a stranger's server would hand them whatever its URL was made to carry.
const IMAGE_HOST = 'images.unsplash.com';

export function isTrustedImageUrl(src: string | undefined): boolean {
  if (!src) return false;
  if (src.startsWith('/media/')) return true;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === IMAGE_HOST && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}
