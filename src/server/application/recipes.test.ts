import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecipeImage } from '../../domain/recipe.ts';
import { fileRecipeRepository } from '../infrastructure/recipes/file-recipe-repository.ts';
import type { Deps } from './deps.ts';
import type { RecipeRepository } from './ports/recipes.ts';
import { findRecipeImage, setRecipePhoto } from './recipes.ts';

const OWN: RecipeImage = { kind: 'photo', file: 'soup-1.webp' };
const UNSPLASH: RecipeImage = { kind: 'unsplash', url: 'https://u/1', thumbUrl: 'https://u/1t', credit: 'A', creditUrl: 'https://u/a' };
const NEW_UNSPLASH: RecipeImage = { ...UNSPLASH, url: 'https://u/2' };

let dir: string;
let recipes: RecipeRepository;
let imageAtRemoval: (RecipeImage | null | undefined)[];
let find: ReturnType<typeof vi.fn>;
let photos: { save: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
let deps: Deps;

const putRecipe = (image: RecipeImage | null) => {
  if (image) recipes.setImage('soup', image);
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-photos-'));
  recipes = fileRecipeRepository(dir, () => {});
  fs.writeFileSync(path.join(dir, 'soup.md'), '---\ntitle: Soup\n---\n\n## Ingredients\n- 1 onion\n');
  imageAtRemoval = [];
  find = vi.fn(async () => NEW_UNSPLASH);
  photos = {
    save: vi.fn(async () => 'soup-2.webp'),
    remove: vi.fn(() => { imageAtRemoval.push(recipes.get('soup')?.image); }),
  };
  deps = { recipes, photos, images: { available: () => true, find }, log: () => {} } as unknown as Deps;
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const soup = () => recipes.get('soup')!;

describe('setRecipePhoto', () => {
  it('removes the photo it replaced, once the new one is on the recipe', async () => {
    putRecipe(OWN);
    await setRecipePhoto(deps, 'soup', Buffer.from('x'));
    expect(soup().image).toEqual({ kind: 'photo', file: 'soup-2.webp' });
    expect(photos.remove.mock.calls).toEqual([['soup-1.webp']]);
    expect(imageAtRemoval).toEqual([{ kind: 'photo', file: 'soup-2.webp' }]);
  });

  it('removes nothing when the old image was from Unsplash or there was none', async () => {
    await setRecipePhoto(deps, 'soup', Buffer.from('x'));
    putRecipe(UNSPLASH);
    await setRecipePhoto(deps, 'soup', Buffer.from('x'));
    expect(photos.remove).not.toHaveBeenCalled();
  });

  it('keeps the old photo when the new one fails to save', async () => {
    putRecipe(OWN);
    photos.save.mockRejectedValueOnce(new Error('not an image'));
    await expect(setRecipePhoto(deps, 'soup', Buffer.from('x'))).rejects.toThrow('not an image');
    expect(soup().image).toEqual(OWN);
    expect(photos.remove).not.toHaveBeenCalled();
  });

  it('keeps the old photo when the recipe cannot take the new one', async () => {
    putRecipe(OWN);
    const setImage = vi.spyOn(recipes, 'setImage').mockImplementation(() => { throw new Error('disk full'); });
    await expect(setRecipePhoto(deps, 'soup', Buffer.from('x'))).rejects.toThrow('disk full');
    setImage.mockRestore();
    expect(photos.remove).not.toHaveBeenCalled();
  });
});

describe('findRecipeImage', () => {
  it('removes the own photo that a new Unsplash pick replaced', async () => {
    putRecipe(OWN);
    expect(await findRecipeImage(deps, soup(), true)).toBe(true);
    expect(soup().image).toEqual(NEW_UNSPLASH);
    expect(photos.remove.mock.calls).toEqual([['soup-1.webp']]);
    expect(imageAtRemoval).toEqual([NEW_UNSPLASH]);
  });

  it('keeps the own photo when the search finds nothing', async () => {
    putRecipe(OWN);
    find.mockResolvedValueOnce(null);
    expect(await findRecipeImage(deps, soup(), true)).toBe(false);
    expect(soup().image).toEqual(OWN);
    expect(photos.remove).not.toHaveBeenCalled();
  });

  it('keeps the own photo when the search fails', async () => {
    putRecipe(OWN);
    find.mockRejectedValueOnce(new Error('offline'));
    expect(await findRecipeImage(deps, soup(), true)).toBe(false);
    expect(soup().image).toEqual(OWN);
    expect(photos.remove).not.toHaveBeenCalled();
  });

  it('removes nothing when swapping one Unsplash photo for another', async () => {
    putRecipe(UNSPLASH);
    await findRecipeImage(deps, soup(), true);
    expect(soup().image).toEqual(NEW_UNSPLASH);
    expect(photos.remove).not.toHaveBeenCalled();
  });

  it('leaves alone a recipe that already has a photo unless asked', async () => {
    putRecipe(OWN);
    expect(await findRecipeImage(deps, soup())).toBe(false);
    expect(find).not.toHaveBeenCalled();
  });

  it('does not replace a photo someone added during a background search', async () => {
    const listed = soup();
    find.mockImplementationOnce(async () => {
      recipes.setImage('soup', OWN);
      return NEW_UNSPLASH;
    });
    expect(await findRecipeImage(deps, listed)).toBe(false);
    expect(soup().image).toEqual(OWN);
    expect(photos.remove).not.toHaveBeenCalled();
  });
});
