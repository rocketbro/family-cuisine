// Folding one pantry item into another that is the same thing. The item kept stays as it is, with the other's name and
// other names added, and takes the other's stock only where its own says nothing is in the house.
import type { ISODate } from './dates.ts';
import type { PantryItem } from './pantry.ts';
import { tidiedOtherNames } from './tidy-fix-pantry.ts';

export type MergePatch = {
  name?: string;
  alsoCalled: string[];
  status?: PantryItem['status'];
  count?: number | null;
  useBy?: ISODate | null;
};

export function mergePatch(keep: PantryItem, remove: PantryItem, newName: string | null, extraNames: readonly string[]): MergePatch {
  const name = newName && newName !== keep.name ? newName : keep.name;
  // The old name of the one kept goes on as another name when it is renamed.
  const others = [...keep.alsoCalled, ...(name !== keep.name ? [keep.name] : []), remove.name, ...remove.alsoCalled, ...extraNames];
  const patch: MergePatch = { alsoCalled: tidiedOtherNames({ name, alsoCalled: others }) };
  if (name !== keep.name) patch.name = name;
  if (keep.count !== null && remove.count !== null) patch.count = keep.count + remove.count;
  else if (keep.status === 'out' && remove.status !== 'out') Object.assign(patch, { status: remove.status, count: remove.count });
  if (keep.status === 'out') {
    if (remove.status !== 'out' && remove.useBy) patch.useBy = remove.useBy;
  } else {
    const soonest = [keep.useBy, remove.useBy].filter((d): d is ISODate => d !== null).sort()[0];
    if (soonest && soonest !== keep.useBy) patch.useBy = soonest;
  }
  return patch;
}
