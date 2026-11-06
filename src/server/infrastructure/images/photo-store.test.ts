import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { filePhotoStore } from './photo-store.ts';

let dir: string;
let photos: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-photos-'));
  photos = path.join(dir, 'photos');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const png = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#c33' } }).png().toBuffer();

describe('a stored photo', () => {
  it('reads back as the WebP it was saved as, until it’s removed', async () => {
    const store = filePhotoStore(photos);
    const file = await store.save(await png(), 'soup');
    expect((await sharp(store.read(file)!).metadata()).format).toBe('webp');
    store.remove(file);
    expect(store.read(file)).toBeNull();
  });

  it('reads nothing but a plain photo name in its own folder', () => {
    const store = filePhotoStore(photos);
    fs.writeFileSync(path.join(dir, 'outside.webp'), 'x');
    expect(store.read('../outside.webp')).toBeNull();
    expect(store.read('notes.txt')).toBeNull();
    expect(store.read('gone.webp')).toBeNull();
  });
});
