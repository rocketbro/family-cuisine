// One day to a screen: swipe sideways, or use the chevrons. The browser does the swiping, with scroll
// snapping. Touches that start on the left edge belong to the app's swipe back, so a strip there
// doesn't let them pan the days.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlanImportPagerState } from './usePlanImportPager.ts';

export function PlanImportPager({ pager, pages }: { pager: PlanImportPagerState; pages: { key: string; label: string; content: ReactNode }[] }) {
  const { ref, index, onScroll, goTo } = pager;
  const page = pages[index] ?? pages[0];
  return (
    <>
      <header className="plan-pager-head">
        <button className="icon-button" aria-label="Previous day" disabled={index <= 0} onClick={() => goTo(index - 1)}><ChevronLeft size={24} /></button>
        <span className="plan-pager-where" aria-live="polite">{page.label} · {index + 1} of {pages.length}</span>
        <button className="icon-button" aria-label="Next day" disabled={index >= pages.length - 1} onClick={() => goTo(index + 1)}><ChevronRight size={24} /></button>
      </header>
      <div className="plan-pager-frame">
        <div className="plan-pager-edge" aria-hidden />
        <div className="plan-pager" ref={ref} onScroll={onScroll}>
          {pages.map(({ key, content }) => <section key={key} className="plan-pager-page">{content}</section>)}
        </div>
      </div>
    </>
  );
}
