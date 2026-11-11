// Said only when ticks really aren't getting through. They're safe on this phone and still going.
export function TicksNote({ unsaved, stuck, onRetry }: { unsaved: number; stuck: boolean; onRetry: () => void }) {
  if (!stuck || !unsaved) return null;
  return (
    <p className="small muted section" role="status">
      {unsaved} {unsaved === 1 ? 'tick' : 'ticks'} not shared yet. Saved on this phone, still trying.{' '}
      <button className="link-button" onClick={onRetry}>Try now</button>
    </p>
  );
}
