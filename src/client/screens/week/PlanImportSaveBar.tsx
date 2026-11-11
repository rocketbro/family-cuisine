// Always on screen under the days: save, or the one thing still in the way, which you can tap to go to.
import { shortDate, weekdayName } from '../../../domain/dates.ts';
import type { SaveBlocker } from '../../../domain/plan-import-choices.ts';
import { ClaudeNote } from '../../ui/ClaudeNote.tsx';
import { TellClaude } from '../../ui/TellClaude.tsx';
import { NO_DAY_PAGE } from './usePlanImportPager.ts';

function reason(blocker: SaveBlocker): string {
  if (blocker.kind === 'clash') return `${weekdayName(blocker.date).slice(0, 3)}, ${shortDate(blocker.date)} ${blocker.slot}: choose one`;
  if (blocker.kind === 'no-day') return blocker.count === 1 ? '1 meal needs a day' : `${blocker.count} meals need a day`;
  return 'Nothing to save';
}

export function PlanImportSaveBar({ count, blocker, problem, note, teller, onSave, onShow, onStartOver }: {
  count: number; blocker: SaveBlocker | null; problem: string | null;
  /** What Claude last changed, and taking it back. */
  note: { words: string; onUndo: () => void } | null;
  /** Null when Claude isn't available. */
  teller: { asking: boolean; underway: boolean; free: boolean; listen: () => void } | null;
  onSave: () => void; onShow: (pageKey: string) => void; onStartOver: () => void;
}) {
  const pageKey = blocker?.kind === 'clash' ? blocker.date : blocker?.kind === 'no-day' ? NO_DAY_PAGE : null;
  return (
    <footer className="plan-save">
      {blocker && (pageKey
        ? <button className="link-button plan-save-reason" onClick={() => onShow(pageKey)}>{reason(blocker)}</button>
        : <p className="plan-save-reason muted small">{reason(blocker)}</p>)}
      {problem && <p className="error small" style={{ margin: 0 }}>{problem}</p>}
      {note && <ClaudeNote words={note.words} onUndo={note.onUndo} />}
      {teller && <TellClaude {...teller} />}
      <button className="button wide" disabled={blocker !== null || teller?.underway === true} onClick={onSave}>Save {count} {count === 1 ? 'meal' : 'meals'}</button>
      <button className="link-button plan-start-over" onClick={onStartOver}>Start over</button>
    </footer>
  );
}
