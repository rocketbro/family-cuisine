// Tells the page how tall the open sheet's footer is, so the dictation bar can sit just above it,
// however many lines the footer has at the moment, and never across its buttons.
import { useEffect, useRef } from 'react';

const PROPERTY = '--sheet-foot-height';

export function useSheetFootHeight() {
  const inFooter = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const foot = inFooter.current?.closest<HTMLElement>('.sheet-foot');
    if (!foot) return;
    const measure = () => document.body.style.setProperty(PROPERTY, `${foot.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(foot);
    return () => {
      observer.disconnect();
      document.body.style.removeProperty(PROPERTY);
    };
  }, []);
  return inFooter;
}
