// A save a person can follow: saving, saved for a few seconds, or what went wrong. Forms keep one
// of these, and SaveNote or SaveBar shows it.
import { useCallback, useEffect, useRef, useState } from 'react';

const SAVED_FOR_MS = 4000;

export type SaveState = {
  phase: 'idle' | 'saving' | 'saved';
  problem: string | null;
  run: (work: () => Promise<unknown>) => Promise<boolean>;
};

export function useSaveState(): SaveState {
  const [phase, setPhase] = useState<SaveState['phase']>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(async (work: () => Promise<unknown>) => {
    clearTimeout(timer.current);
    setPhase('saving');
    setProblem(null);
    try {
      await work();
      setPhase('saved');
      timer.current = setTimeout(() => setPhase('idle'), SAVED_FOR_MS);
      return true;
    } catch (e) {
      setPhase('idle');
      setProblem((e as Error).message);
      return false;
    }
  }, []);

  return { phase, problem, run };
}
