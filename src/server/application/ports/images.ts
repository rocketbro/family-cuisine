import type { RecipeImage } from '../../../domain/recipe.ts';

export type ImageSearchPort = {
  available(): boolean;
  /** Finds one photo for a dish and records that it was used: the best match, or with `replacing` (a photo's URL) a different one. */
  find(query: string, replacing?: string): Promise<RecipeImage | null>;
};

export type PhotoStorePort = {
  /** Resizes and stores a photo; returns the stored file name. */
  save(data: Buffer, prefix: string): Promise<string>;
  /** The stored photo, or null when there's no such file. */
  read(file: string): Buffer | null;
  remove(file: string): void;
  /** Shrinks a photo for sending to the model. */
  forModel(data: Buffer): Promise<{ mediaType: 'image/jpeg'; data: string }>;
};
