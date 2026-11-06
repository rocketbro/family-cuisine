// The family's own food photos, stored as resized WebP files in the data directory.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { PhotoStorePort } from '../../application/ports/images.ts';
import { UserError } from '../../application/user-error.ts';

const notAPhoto = (): never => {
  throw new UserError('That file isn’t a photo this app can read.', 415);
};

export function filePhotoStore(dir: string): PhotoStorePort {
  fs.mkdirSync(dir, { recursive: true });
  const existing = (file: string) => {
    if (!/^[a-z0-9-]+\.webp$/.test(file)) return null;
    const full = path.join(dir, file);
    return fs.existsSync(full) ? full : null;
  };
  return {
    async save(data, prefix) {
      const file = `${prefix.replace(/[^a-z0-9-]/g, '')}-${Date.now()}.webp`;
      await sharp(data).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, file)).catch(notAPhoto);
      return file;
    },
    read(file) {
      const full = existing(file);
      return full ? fs.readFileSync(full) : null;
    },
    remove(file) {
      const full = existing(file);
      if (full) fs.rmSync(full);
    },
    async forModel(data) {
      const jpeg = await sharp(data).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer().catch(notAPhoto);
      return { mediaType: 'image/jpeg', data: jpeg.toString('base64') };
    },
  };
}
