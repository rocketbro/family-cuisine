// Runs a save and keeps what went wrong, so a failure shows on screen instead of vanishing
// as an unhandled rejection. `retry` runs the same save again, for Problem's "Try again".
import { useCallback, useState } from 'react';

export type Failure = { message: string; retry: () => void };

export async function attempt(write: () => Promise<unknown>, report: (failure: Failure | null) => void): Promise<boolean> {
  report(null);
  try {
    await write();
    return true;
  } catch (e) {
    report({ message: (e as Error).message, retry: () => void attempt(write, report) });
    return false;
  }
}

export function useWrite() {
  const [failure, setFailure] = useState<Failure | null>(null);
  const run = useCallback((write: () => Promise<unknown>) => attempt(write, setFailure), []);
  return { run, problem: failure?.message ?? null, retry: failure?.retry };
}
