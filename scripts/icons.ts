// Renders the PNG app icons from scripts/icon-source.png. Run after changing the icon: npm run icons
// iOS wants an opaque square (it rounds the corners itself) and looks for /apple-touch-icon.png.
// A home screen keeps the icon it got at install, and browsers keep theirs: when this changes, bump
// the ?v= on the links in index.html and manifest.webmanifest. Someone with it installed re-adds it.
import path from 'node:path';
import sharp from 'sharp';

const here = import.meta.dirname;
const pub = path.resolve(here, '..', 'public');
const source = path.join(here, 'icon-source.png');
const outputs: [string, number][] = [['icon-32.png', 32], ['icon-180.png', 180], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]];
for (const [file, size] of outputs) {
  await sharp(source).resize(size, size).removeAlpha().png().toFile(path.join(pub, file));
}
console.log('icons written');
