// What can be done to a line from the list. Each waits for the server, then for the fresh list, so
// the total on screen is the one that counts the change.
import { useState } from 'react';
import { api } from '../../api.ts';
import { useWrite } from '../../hooks/useWrite.ts';

export function useLineActions(reload: () => Promise<void>, forgetTicks: (keys: string[]) => void) {
  const write = useWrite();
  const [busy, setBusy] = useState<string | null>(null);

  const change = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key);
    const done = await write.run(async () => {
      await work();
      forgetTicks([key]);
      await reload();
    });
    setBusy(null);
    return done;
  };

  return {
    busy,
    problem: write.problem,
    retry: write.retry,
    inHouse: (key: string) => change(key, () => api.lineInHouse(key)),
    skip: (key: string) => change(key, () => api.skipLine(key, true)),
    restore: (key: string) => change(key, () => api.skipLine(key, false)),
  };
}

export type LineActions = ReturnType<typeof useLineActions>;
