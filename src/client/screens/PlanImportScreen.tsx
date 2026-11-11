// Bringing in a meal plan someone already wrote out. It's read on the server, so leaving this screen
// or the phone sleeping is fine: coming back lands on wherever it got to.
import { useEffect } from 'react';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { PlanImportForm } from './week/PlanImportForm.tsx';
import { PlanImportReview } from './week/PlanImportReview.tsx';
import { PlanImportSaved } from './week/PlanImportSaved.tsx';

const POLL_MS = 3000;

export function PlanImportScreen() {
  const { data: view, error, reload } = useLoad('plan-import', () => api.planImport());
  const { data: status } = useLoad('status', () => api.status());
  const write = useWrite();
  const reading = view?.status === 'reading';

  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [reading, reload]);

  if (!view || !status) return <div className="page">{error ? <Problem message={error} onRetry={reload} /> : <Loading />}</div>;

  const startOver = () => write.run(async () => { await api.discardPlanImport(); await reload(); });

  // The review is the whole screen, a day at a time.
  if (view.status === 'ready') return (
    <div className="page plan-review-page">
      <PlanImportReview key={view.id} view={view} onSaved={reload} onStartOver={startOver} />
    </div>
  );

  return (
    <div className="page">
      <h1 style={{ marginBottom: 12 }}>Import a meal plan</h1>
      {view.status === 'none' && <PlanImportForm aiOn={status.ai} shopping={status.shopping} onStarted={reload} />}
      {view.status === 'reading' && <p className="section muted italic">Reading the plan. You can leave this screen.</p>}
      {view.status === 'failed' && (
        <section className="section stack">
          <p className="error">{view.error}</p>
          {view.canRetry && <button className="button wide" onClick={() => write.run(async () => { await api.retryPlanImport(); await reload(); })}>Try again</button>}
          <button className="button quiet wide" onClick={startOver}>{view.canRetry ? 'Start over' : 'Add the plan again'}</button>
        </section>
      )}
      {view.status === 'saved' && <PlanImportSaved view={view} shopping={status.shopping} onAnother={startOver} />}
      {write.problem && <p className="error" style={{ marginTop: 12 }}>{write.problem}</p>}
    </div>
  );
}
