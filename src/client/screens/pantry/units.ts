// The units offered for an amount, plus whatever one it already has.
import type { Unit } from '../../../domain/units.ts';

const COMMON = ['lb', 'oz', 'package', 'can', 'cup', 'quart'];

export function unitOptions(current: Unit | null): { value: string; label: string }[] {
  return [{ value: '', label: 'each' }, ...[...new Set([...COMMON, ...(current ? [current] : [])])].map(u => ({ value: u, label: u }))];
}

export const UNIT_OPTIONS = unitOptions(null);
