// When a site turns the import away: offer to have Claude try, and always say screenshots work.
export type BlockedStep = 'ask' | 'screenshots';

type Props = { step: BlockedStep; busy: boolean; onYes: () => void; onNo: () => void; onScreenshots: () => void };

export function BlockedOffer({ step, busy, onYes, onNo, onScreenshots }: Props) {
  if (busy) return null;
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {step === 'ask' && (
        <>
          <p>Try again with Claude?</p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="button" onClick={onYes}>Yes</button>
            <button type="button" className="button quiet" onClick={onNo}>No</button>
          </div>
        </>
      )}
      <p className="muted small">You can also take screenshots of the recipe and add them under Photos.</p>
      {step === 'screenshots' && <button type="button" className="button quiet wide" onClick={onScreenshots}>Use screenshots</button>}
    </div>
  );
}
