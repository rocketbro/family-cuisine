// Where a flip-through is: which page is showing, kept by the page's key so a page coming or going
// (a meal moved, the last one on a day removed) doesn't lose your place.
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** The page for meals with no day yet. */
export const NO_DAY_PAGE = 'none';

export type PlanImportPagerState = {
  ref: RefObject<HTMLDivElement | null>;
  index: number;
  onScroll: () => void;
  goTo: (index: number) => void;
  show: (key: string) => void;
};

export function usePlanImportPager(keys: readonly string[]): PlanImportPagerState {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const place = useRef({ key: keys[0], index: 0 });
  const joined = keys.join(' ');

  const settle = useCallback((at: number, pages: string[]) => {
    place.current = { key: pages[at], index: at };
    setIndex(at);
  }, []);

  // The pages changed: stay on the same day, or the nearest to where it was.
  useLayoutEffect(() => {
    const pages = joined.split(' ');
    const found = pages.indexOf(place.current.key);
    const at = found >= 0 ? found : Math.min(place.current.index, pages.length - 1);
    const el = ref.current;
    if (el) el.scrollLeft = at * el.clientWidth;
    settle(at, pages);
  }, [joined, settle]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el?.clientWidth) return;
    const pages = joined.split(' ');
    const at = Math.round(el.scrollLeft / el.clientWidth);
    if (at >= 0 && at < pages.length) settle(at, pages);
  }, [joined, settle]);

  const goTo = useCallback((to: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' });
  }, []);

  const show = useCallback((key: string) => {
    const to = joined.split(' ').indexOf(key);
    if (to >= 0) goTo(to);
  }, [joined, goTo]);

  return { ref, index, onScroll, goTo, show };
}
