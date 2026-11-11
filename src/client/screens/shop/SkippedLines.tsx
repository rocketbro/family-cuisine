// "2 skipped": what's been left off this trip, folded away, each with a way back.
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { formatDollars, lineCents } from '../../../domain/prices.ts';
import type { PricedLine } from '../../../shared/api-types.ts';
import { Problem } from '../../ui/Common.tsx';
import { lineText } from './lineText.ts';
import type { LineActions } from './useLineActions.ts';

export function SkippedRow({ line, actions }: { line: PricedLine; actions: LineActions }) {
  return (
    <div className="list-row">
      <span className="grow">
        {lineText(line)}
        {line.price && <span className="faint small" style={{ display: 'block' }}>{formatDollars(lineCents(line, line.price))}</span>}
      </span>
      <button className="button quiet" aria-label={`Put ${line.name} back on the list`} disabled={actions.busy !== null} onClick={() => void actions.restore(line.key)}>Put back</button>
    </div>
  );
}

export function SkippedLines({ lines, actions }: { lines: PricedLine[]; actions: LineActions }) {
  const [open, setOpen] = useState(false);
  if (!lines.length) return null;
  return (
    <section className="section">
      <button className="category-head skipped-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown size={16} className="chevron" />
        <span className="eyebrow">{lines.length} skipped</span>
        <span className="faint small">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="list">{lines.map(line => <SkippedRow key={line.key} line={line} actions={actions} />)}</div>}
      {actions.problem && <Problem message={actions.problem} onRetry={actions.retry} />}
    </section>
  );
}
