// The slim bar that sits above the tabs while dictating. Scroll and move around freely.
// Listening, it counts down what's left of the take's ten minutes. When a take runs out (or a
// call cuts it off), it offers to keep going. When something fails, the recording is safe and
// the bar says so: Retry, save the audio, or (with a second tap) let it go.
import { Check, Download, LoaderCircle, Mic, RotateCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { HeldWords } from './HeldWords.tsx';
import { allWords } from './session.ts';
import type { Pause } from './useDictationSession.ts';
import type { Take } from './session.ts';
import type { DictationPhase } from './useDictation.ts';

type Props = {
  phase: DictationPhase;
  label: string;
  takes: Take[];
  remaining: number;
  status: string;
  error: string | null;
  pause: Pause | null;
  /** Field dictation only: the words go in by themselves if their field's screen comes back. */
  returns: boolean;
  /** Typed notes waiting for this session to finish. */
  next: string;
  onStop: () => void;
  onCancel: () => void;
  onKeepGoing: () => void;
  onDone: () => void;
  onRetry: () => void;
  onDiscard: () => void;
};

export function DictationBar(p: Props) {
  const [confirming, setConfirming] = useState(false);
  const part = p.takes.length + 1;
  const stuck = p.takes.find(t => t.text === null && t.recordingId);
  const next = p.next && <span className="dictation-label">Next: {p.next}</span>;

  return (
    <div className={`dictation-bar ${p.phase}`} role="status" aria-live="polite">
      {p.phase === 'listening' && (
        <>
          <span className="listening-dot" aria-hidden="true" />
          <span className="grow">
            <span className={`dictation-title ${p.remaining <= 60 ? 'ending' : ''}`}>{formatSeconds(p.remaining)} left{part > 1 ? ` · part ${part}` : ''}</span>
            <span className="dictation-label">{p.label}</span>
            {next}
          </span>
          <button className="icon-button" aria-label={part > 1 ? 'Drop this part' : 'Cancel'} onClick={p.onCancel}><X size={20} /></button>
          <button className="button small" onClick={p.onStop}><Check size={16} /> Done</button>
        </>
      )}
      {p.phase === 'working' && (
        <>
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          <span className="grow">
            <span className="dictation-title">{p.status || 'Working…'}</span>
            {next}
          </span>
        </>
      )}
      {p.phase === 'paused' && (
        <>
          <span className="grow">
            <span className="dictation-title">{p.pause?.reason === 'interrupted' ? 'Mic cut off' : p.pause?.reason === 'limit' ? 'Time’s up' : 'Paused'}</span>
            <span className="dictation-label">{p.error ?? (p.takes.length > 1 ? `${p.takes.length} parts so far` : 'Saved. Nothing’s lost')}</span>
            {next}
          </span>
          <button className="button small quiet-on-dark" onClick={p.onKeepGoing}><Mic size={16} /> Keep going</button>
          <button className="button small" onClick={p.onDone}><Check size={16} /> Done</button>
        </>
      )}
      {p.phase === 'failed' && (
        <>
          <span className="grow error-text">{p.error}{next}</span>
          {stuck && (
            <a className="icon-button" aria-label="Save the audio" href={`/api/recordings/${stuck.recordingId}/audio`} download><Download size={19} /></a>
          )}
          <button className={`icon-button ${confirming ? 'confirming' : ''}`} aria-label={confirming ? 'Tap again to throw it away' : 'Throw it away'}
            onClick={() => (confirming ? p.onDiscard() : setConfirming(true))} onBlur={() => setConfirming(false)}>
            {confirming ? <span className="small">Sure?</span> : <Trash2 size={19} />}
          </button>
          <button className="button small" onClick={p.onRetry}><RotateCw size={16} /> Retry</button>
        </>
      )}
      {p.phase === 'words' && <HeldWords label={p.label} words={allWords({ takes: p.takes })} returns={p.returns} next={next} onDiscard={p.onDiscard} />}
      {p.phase === 'error' && (
        <>
          <span className="grow error-text">{p.error}{next}</span>
          <button className="icon-button" aria-label="Dismiss" onClick={p.onDiscard}><X size={20} /></button>
        </>
      )}
    </div>
  );
}

function formatSeconds(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
