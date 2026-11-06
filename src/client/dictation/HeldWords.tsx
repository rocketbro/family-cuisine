// The bar's face when a field's words are ready and the field is gone. The words stay here,
// through a reload, until they go in by themselves on returning to the field, or the person
// lets them go: one tap once they're copied, two before.
import { Copy, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type Props = {
  label: string;
  words: string;
  /** Whether going back to the field will put them in. */
  returns: boolean;
  next: ReactNode;
  onDiscard: () => void;
};

export function HeldWords({ label, words, returns, next, onDiscard }: Props) {
  const [copy, setCopy] = useState<'ready' | 'copied' | 'failed'>('ready');
  const [confirming, setConfirming] = useState(false);
  const hint = copy === 'copied' ? 'Copied. Paste it where you like.'
    : copy === 'failed' ? 'Couldn’t copy. Press and hold the words to select them.'
    : returns ? 'They’ll go in when you’re back there. Or copy them.'
    : 'Copy them to paste where you were typing.';

  return (
    <>
      <span className="grow">
        <span className="dictation-title">Your words for “{label}”</span>
        <span className="dictation-words" style={{ display: 'block' }}>{words}</span>
        <span className="dictation-label">{hint}</span>
        {next}
      </span>
      <button className="button small" onClick={() => void navigator.clipboard.writeText(words).then(() => setCopy('copied'), () => setCopy('failed'))}><Copy size={16} /> Copy</button>
      {copy === 'copied'
        ? <button className="icon-button" aria-label="Dismiss" onClick={onDiscard}><X size={20} /></button>
        : (
          <button className={`icon-button ${confirming ? 'confirming' : ''}`} aria-label={confirming ? 'Tap again to throw them away' : 'Throw them away'}
            onClick={() => (confirming ? onDiscard() : setConfirming(true))} onBlur={() => setConfirming(false)}>
            {confirming ? <span className="small">Sure?</span> : <Trash2 size={19} />}
          </button>
        )}
    </>
  );
}
