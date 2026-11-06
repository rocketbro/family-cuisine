import { describe, expect, it } from 'vitest';
import type { PantryItem } from '../../../domain/pantry.ts';
import { lastConfirmed, withChange, withSaved, without } from './optimistic-items.ts';

const item = (id: number, status: PantryItem['status'] = 'have') => ({ id, name: `item ${id}`, status }) as PantryItem;
const statusOf = (items: PantryItem[], id: number) => items.find(i => i.id === id)?.status;
const undo = (items: PantryItem[], id: number, saved: Map<number, PantryItem>, loaded: PantryItem[]) => withSaved(items, lastConfirmed(id, saved, loaded)!);

describe('optimistic pantry items', () => {
  const loaded = [item(1), item(2)];

  it('shows a change on the one item it touches', () => {
    const shown = withChange(loaded, 1, { status: 'low' });
    expect(statusOf(shown, 1)).toBe('low');
    expect(statusOf(shown, 2)).toBe('have');
  });

  it('puts what the server saved in place of the guess', () => {
    expect(statusOf(withSaved(withChange(loaded, 1, { status: 'low' }), item(1, 'out')), 1)).toBe('out');
  });

  it('drops a removed item', () => {
    expect(without(loaded, 1).map(i => i.id)).toEqual([2]);
  });

  it('goes back to the loaded value when a tap fails', () => {
    expect(statusOf(undo(withChange(loaded, 1, { status: 'low' }), 1, new Map(), loaded), 1)).toBe('have');
  });

  it('goes all the way back when two quick taps both fail', () => {
    const shown = withChange(withChange(loaded, 1, { status: 'low' }), 1, { status: 'out' });
    expect(statusOf(undo(shown, 1, new Map(), loaded), 1)).toBe('have');
  });

  it('keeps the first tap when it saved and only the second failed', () => {
    const shown = withChange(withSaved(loaded, item(1, 'low')), 1, { status: 'out' });
    expect(statusOf(undo(shown, 1, new Map([[1, item(1, 'low')]]), loaded), 1)).toBe('low');
  });

  it('leaves other items’ unsaved taps alone', () => {
    const shown = withChange(withChange(loaded, 1, { status: 'low' }), 2, { status: 'out' });
    expect(statusOf(undo(shown, 1, new Map(), loaded), 2)).toBe('out');
  });

  it('knows nothing about an item it never saw', () => {
    expect(lastConfirmed(3, new Map(), loaded)).toBeNull();
  });
});
