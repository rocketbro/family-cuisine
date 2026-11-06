// Saving pantry changes. Taps show at once in an optimistic copy, and fresh data from the
// server (after a dictation, say) replaces it. A save that fails puts the item back as the
// server has it, says so at the row it happened on, and offers to try again.
import { useEffect, useRef, useState } from 'react';
import type { PantryItem } from '../../../domain/pantry.ts';
import { api } from '../../api.ts';
import type { ItemChange } from './item-change.ts';
import { lastConfirmed, withChange, withSaved, without } from './optimistic-items.ts';

/** Where the failure shows: a row's key, or the form that adds items. */
export type WriteProblem = { where: string; message: string; retry: () => void };

type Items = PantryItem[] | null;

export function usePantryWrites(data: Items, reload: () => Promise<void>) {
  const [optimistic, setOptimistic] = useState<{ from: Items; items: PantryItem[] } | null>(null);
  const [problem, setProblem] = useState<WriteProblem | null>(null);
  const saved = useRef(new Map<number, PantryItem>());
  // A save can outlive the load it started from (the retry after a failure always does).
  const loaded = useRef(data);
  useEffect(() => { loaded.current = data; saved.current.clear(); }, [data]);

  const setItems = (change: (current: PantryItem[]) => PantryItem[]) =>
    setOptimistic(prev => ({ from: loaded.current, items: change(prev && prev.from === loaded.current ? prev.items : loaded.current ?? []) }));

  /** Resolves to whether it saved. A move or an addition shows once the server has worked it out. */
  const patch = async (item: PantryItem, { move, add: addition, ...change }: ItemChange, where: string): Promise<boolean> => {
    setProblem(null);
    setItems(current => withChange(current, item.id, change));
    try {
      const result = await api.updatePantryItem(item.id, { ...change, move, add: addition });
      saved.current.set(result.id, result);
      setItems(current => withSaved(current, result));
      return true;
    } catch (e) {
      setItems(current => withSaved(current, lastConfirmed(item.id, saved.current, loaded.current) ?? item));
      setProblem({ where, message: (e as Error).message, retry: () => void patch(item, { ...change, move, add: addition }, where) });
      void reload();
      return false;
    }
  };

  /** Resolves to whether it saved, so the form keeps what was typed if it didn't. */
  const add = async (name: string, where: string): Promise<boolean> => {
    setProblem(null);
    try {
      await api.addPantryItem({ name });
    } catch (e) {
      setProblem({ where, message: (e as Error).message, retry: () => void add(name, where) });
      return false;
    }
    setOptimistic(null);
    await reload();
    return true;
  };

  const remove = async (item: PantryItem, where: string): Promise<boolean> => {
    setProblem(null);
    try {
      await api.removePantryItem(item.id);
    } catch (e) {
      setProblem({ where, message: (e as Error).message, retry: () => void remove(item, where) });
      return false;
    }
    setItems(current => without(current, item.id));
    return true;
  };

  return { items: optimistic && optimistic.from === data ? optimistic.items : data, problem, patch, add, remove };
}
