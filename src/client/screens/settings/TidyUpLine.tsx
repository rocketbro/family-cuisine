// A small line on Settings: when the tidy-up last ran and what it fixed, with the fixes one tap away.
import { tidySummary } from '../../../domain/tidy-log.ts';
import { api } from '../../api.ts';
import { useLoad } from '../../hooks/useLoad.ts';

export function TidyUpLine() {
  const { data } = useLoad('tidy-up', () => api.tidyUp());
  if (!data) return null;
  const { last } = data;

  return (
    <details className="faint small section tidy-last">
      <summary>Tidy-up · {tidySummary(last)}</summary>
      {last?.fixed.length ? <ul>{last.fixed.map((line, i) => <li key={i}>{line}</li>)}</ul> : null}
    </details>
  );
}
