// Loads data for a screen. Each load is cached by key, so going back to a screen or
// switching tabs shows what was there at once while a fresh copy loads. It reloads after a
// change anywhere in the app, when the phone wakes, and (a few times) after a failure, so a
// request that died while the phone slept never leaves a screen stuck.
import { useCallback, useEffect, useRef, useState } from 'react';
import { onChange } from '../data-events.ts';

const cache = new Map<string, unknown>();
const RETRY_AFTER = [1500, 4000, 10000];

type State<T> = { key: string; data: T | null; error: string | null; failures: number };
function fresh<T>(key: string): State<T> {
  return { key, data: (cache.get(key) as T) ?? null, error: null, failures: 0 };
}

type Loaded<T> = {
  data: T | null; error: string | null; reload: () => Promise<void>;
  /** A background look with another read. Failing says nothing: the next look tries again. */
  refresh: (read: () => Promise<T>) => Promise<void>;
};

export function useLoad<T>(key: string, load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<State<T>>(() => fresh(key));
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const run = ++latest.current;
    try {
      const data = await loadRef.current();
      cache.set(key, data);
      if (run === latest.current) setState({ key, data, error: null, failures: 0 });
    } catch (e) {
      if (run !== latest.current) return;
      setState(s => {
        const base = s.key === key ? s : fresh<T>(key);
        return { ...base, error: (e as Error).message, failures: base.failures + 1 };
      });
    }
  }, [key]);

  const refresh = useCallback(async (read: () => Promise<T>) => {
    const run = ++latest.current;
    const data = await read().catch(() => null);
    if (data === null) return;
    cache.set(key, data);
    if (run === latest.current) setState({ key, data, error: null, failures: 0 });
  }, [key]);

  useEffect(() => {
    void reload();
    return onChange(() => void reload());
  }, [reload]);

  // A failed load tries again by itself a few times before it asks for a tap.
  const current = state.key === key ? state : fresh<T>(key);
  useEffect(() => {
    const wait = RETRY_AFTER[current.failures - 1];
    if (wait === undefined) return;
    const timer = setTimeout(() => void reload(), wait);
    return () => clearTimeout(timer);
  }, [current.failures, reload]);

  // While there's something to show, keep showing it rather than an error.
  return { data: current.data, error: current.data === null ? current.error : null, reload, refresh };
}
