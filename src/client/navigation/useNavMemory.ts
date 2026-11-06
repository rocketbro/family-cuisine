// Runs once in the shell: keeps the tab and scroll memory up to date as you move around,
// and puts each screen at the right scroll position when it opens.
import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import { historyIndex, memory } from './history.ts';
import { pathOf, tabOf } from './tabs.ts';

export function useNavMemory(): void {
  const location = useLocation();
  const path = pathOf(location);

  useEffect(() => { window.history.scrollRestoration = 'manual'; }, []);

  useEffect(() => {
    memory.rememberTab(tabOf(location), { path, state: location.state });
    const index = historyIndex();
    if (index !== null) memory.recordIndex(index, path);
  }, [location, path]);

  // Save the scroll position as you go, for this screen.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => memory.saveScroll(path, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [path]);

  // Opening a new screen starts at the top; coming back restores where you were. The page
  // may still be filling in, so keep trying for a moment until it's tall enough.
  useLayoutEffect(() => {
    const target = memory.takeScrollMode() === 'restore' ? memory.scrollFor(path) : 0;
    window.scrollTo(0, target);
    if (target === 0) return;
    let tries = 0;
    let frame = requestAnimationFrame(function again() {
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) > 2 && ++tries < 30) frame = requestAnimationFrame(again);
    });
    return () => cancelAnimationFrame(frame);
  }, [path]);
}
