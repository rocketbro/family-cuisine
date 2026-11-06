// Back is a swipe, so a screen can't count on a Save tap. If the form still has changes when its
// screen goes away, they get saved rather than lost.
import { useEffect, useRef } from 'react';

export function useSaveOnLeave(dirty: boolean, save: () => unknown): void {
  const latest = useRef({ dirty, save });
  useEffect(() => { latest.current = { dirty, save }; });
  useEffect(() => () => {
    if (latest.current.dirty) latest.current.save();
  }, []);
}
