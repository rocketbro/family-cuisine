// One dictation session for the whole app. Start it from any mic button and keep using the
// app while it listens: the bar stays at the bottom, counting down the take's ten minutes.
// When you're done, the model works out what you meant and the review sheet shows the changes.
// The recording itself is handled by useDictationSession, which never throws audio away.
import { useEffect, useMemo, type ReactNode } from 'react';
import { DictationBar } from './DictationBar.tsx';
import { ReviewSheet } from './ReviewSheet.tsx';
import { DictationContext, type Dictation } from './useDictation.ts';
import { useDictationSession } from './useDictationSession.ts';

export function DictationProvider({ children }: { children: ReactNode }) {
  const d = useDictationSession();

  // Leave room at the foot of each page so the bar never covers the last row.
  useEffect(() => {
    document.body.classList.toggle('dictating', d.phase !== 'idle' && d.phase !== 'review');
  }, [d.phase]);

  const { phase, holding, start, send, offerField } = d;
  const heldField = d.session?.field ?? null;
  const value = useMemo<Dictation>(() => ({
    phase,
    holding,
    heldField,
    start: (context, label) => start(context, label),
    send,
    dictate: (field, label) => start({ kind: 'anywhere' }, label, field),
    offerField,
  }), [phase, holding, heldField, start, send, offerField]);

  return (
    <DictationContext.Provider value={value}>
      {children}
      {d.phase !== 'idle' && d.phase !== 'review' && (
        <DictationBar
          phase={d.phase}
          label={d.session?.label ?? ''}
          takes={d.session?.takes ?? []}
          remaining={d.remaining}
          status={d.status}
          error={d.error}
          pause={d.pause}
          returns={Boolean(d.session?.field)}
          next={d.waiting.map(note => note.label).join(', ')}
          onStop={d.stop}
          onCancel={() => void d.cancelTake()}
          onKeepGoing={() => void d.keepGoing()}
          onDone={() => void d.done()}
          onRetry={() => void d.retry()}
          onDiscard={() => void d.discard()}
        />
      )}
      {d.phase === 'review' && d.proposal && d.session && (
        <ReviewSheet proposal={d.proposal} context={d.session.context} onClose={() => void d.discard()} onKeepTalking={() => void d.keepGoing()} />
      )}
    </DictationContext.Provider>
  );
}
