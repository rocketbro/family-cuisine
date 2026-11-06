// What happens to a dictation, step by step, so nothing said is ever lost:
//   1. each take is kept on the phone (IndexedDB) the moment it ends;
//   2. it's uploaded to the server, which keeps the original (then the phone's copy goes);
//   3. the server transcribes it; a failure leaves the original there for Retry;
//   4. when you're done, all the takes' words go to the model together, or into a text field.
// A text field may be gone by then. The session and its audio stay until the words are in the
// field: the bar shows them to copy, and they go in by themselves when the field comes back,
// even after a reload (field-words.ts). The session is saved after every step, so a reload comes
// back to where it was, or to Retry. A take that hits
// the 10-minute limit (or is cut off by a call) pauses with "Keep going" or "Done".
//
// One session owns the bar at a time (ownership.ts). Nothing but the person's own choice on
// the bar or review sheet ends it: a mic tap meanwhile does nothing, and typed notes wait in line.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListenContext, Proposal } from '../../shared/api-types.ts';
import { api } from '../api.ts';
import { useRecorder, type Recording } from '../hooks/useRecorder.ts';
import { localAudio } from './local-audio.ts';
import { fieldOutcome, handOver, NOTHING_HEARD, restoredMessage, restoredPhase, type FieldTaker } from './field-words.ts';
import { canKeepGoing, micDecision, nextInLine, occupant, restoredSession, typedDecision, type WaitingNote } from './ownership.ts';
import { allWords, savedSession, savedWaiting, type Session } from './session.ts';
import type { DictationPhase } from './useDictation.ts';

export type Pause = { reason: 'limit' | 'interrupted' };

export function useDictationSession() {
  const [session, setSessionState] = useState<Session | null>(() => restoredSession(savedSession.load()));
  const [phase, setPhaseState] = useState<DictationPhase>(() => restoredPhase(restoredSession(savedSession.load())));
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(() => restoredMessage(restoredSession(savedSession.load())));
  const [pause, setPause] = useState<Pause | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [waiting, setWaitingState] = useState<WaitingNote[]>(() => savedWaiting.load());
  /** The text fields on screen right now, by name. */
  const fields = useRef(new Map<string, FieldTaker>());
  const [fieldsOffered, setFieldsOffered] = useState(0);
  const current = useRef<Session | null>(session);
  // Callers can hold an old render across a network wait, so who owns the bar is read from these.
  const phaseNow = useRef(phase);
  const waitingNow = useRef(waiting);
  const starting = useRef(false);
  const ownership = useCallback(() => ({ phase: phaseNow.current, session: current.current, starting: starting.current }), []);

  const setPhase = useCallback((next: DictationPhase) => {
    phaseNow.current = next;
    setPhaseState(next);
  }, []);
  const setWaiting = useCallback((next: WaitingNote[]) => {
    waitingNow.current = next;
    savedWaiting.save(next);
    setWaitingState(next);
  }, []);

  const setSession = useCallback((next: Session | null) => {
    current.current = next;
    savedSession.save(next);
    setSessionState(next);
  }, []);
  const update = useCallback((change: (s: Session) => Session) => {
    if (current.current) setSession(change(current.current));
  }, [setSession]);

  const fail = useCallback((message: string) => { setError(message); setPhase('failed'); }, [setPhase]);

  /** Ends the session and its recordings. Only the person's own choice, or words safely in their field, leads here. */
  const clear = useCallback(async () => {
    const s = current.current;
    setSession(null);
    setProposal(null);
    setPause(null);
    setError(null);
    setPhase('idle');
    await discardRecordings(s);
  }, [setSession, setPhase]);

  /** Puts a finished session's words in their field if it's there. If it isn't, the bar holds them. */
  const settleField = useCallback(async () => {
    const s = current.current;
    if (!s) return;
    const words = allWords(s);
    const target = s.field ? fields.current.get(s.field) : undefined;
    const outcome = fieldOutcome(words, Boolean(target));
    if (outcome === 'nothing-heard') { fail(NOTHING_HEARD); return; }
    if (outcome === 'hold' || !target) { setPhase('words'); return; }
    // A field may take a while with them, and nothing else starts meanwhile: the bar is working.
    setStatus('Making your changes…');
    setPhase('working');
    const result = await handOver(target, words);
    if (result.kind === 'held') setPhase('words');
    else if (result.kind === 'failed') fail(`${result.message} What you said is saved; tap Retry.`);
    else await clear();
  }, [clear, fail, setPhase]);

  /** Uploads and transcribes any take that needs it, then finishes or pauses. Safe to repeat. */
  const process = useCallback(async () => {
    const s = current.current;
    if (!s) return;
    setError(null);
    setPhase('working');
    for (const [index, { localId }] of s.takes.entries()) {
      const take = () => current.current?.takes.find(t => t.localId === localId);
      if (take()?.recordingId === null) {
        setStatus('Saving your recording…');
        const audio = await localAudio.get(localId);
        if (!audio) { fail('That recording didn’t save on this phone. Sorry: say it again?'); return; }
        try {
          const { id } = await api.saveRecording(audio.blob, audio.filename, s.label);
          update(x => ({ ...x, takes: x.takes.map(t => (t.localId === localId ? { ...t, recordingId: id } : t)) }));
          await localAudio.remove(localId);
        } catch (e) { fail(`Couldn’t send the recording to the server (${(e as Error).message}). It’s kept on this phone.`); return; }
      }
      if (take()?.text === null) {
        setStatus(s.takes.length > 1 ? `Transcribing part ${index + 1}…` : 'Transcribing…');
        try {
          const { text } = await api.transcribeRecording(take()!.recordingId!);
          update(x => ({ ...x, takes: x.takes.map(t => (t.localId === localId ? { ...t, text } : t)) }));
        } catch (e) { fail((e as Error).message); return; }
      }
    }
    const done = current.current!;
    if (!done.finishing) { setPhase('paused'); return; }
    const words = allWords(done);
    if (done.toField) { await settleField(); return; }
    if (!words && done.context.kind !== 'cooked') { fail(NOTHING_HEARD); return; }
    setStatus('Sorting out what you said…');
    try {
      setProposal(await api.listen(words, done.context));
      setPhase('review');
    } catch (e) { fail(`${(e as Error).message} What you said is saved; tap Retry.`); }
  }, [update, setPhase, fail, settleField]);

  const onEnded = useCallback(async (recording: Recording) => {
    const localId = crypto.randomUUID();
    try { await localAudio.put(localId, { blob: recording.blob, filename: recording.filename }); } catch { /* upload straight away instead */ }
    const take = { localId, recordingId: null, seconds: recording.seconds, text: null };
    update(s => ({ ...s, takes: [...s.takes, take], finishing: recording.ended === 'stopped' }));
    if (recording.ended !== 'stopped') setPause({ reason: recording.ended });
    // If IndexedDB failed, upload the blob we have in hand.
    if (!(await localAudio.get(localId).catch(() => null))) {
      try {
        const { id } = await api.saveRecording(recording.blob, recording.filename, current.current?.label ?? 'Dictation');
        update(s => ({ ...s, takes: s.takes.map(t => (t.localId === localId ? { ...t, recordingId: id } : t)) }));
      } catch (e) { fail(`Couldn’t keep that recording (${(e as Error).message}).`); return; }
    }
    await process();
  }, [update, process, fail]);

  const recorder = useRecorder(recording => void onEnded(recording));

  const listen = useCallback(async (continuing: boolean) => {
    starting.current = true;
    setError(null);
    setPause(null);
    setProposal(null);
    try {
      await recorder.start();
      setPhase('listening');
    } catch (e) {
      setError((e as Error).message);
      setPhase(continuing ? 'paused' : 'error');
    } finally {
      starting.current = false;
    }
  }, [recorder, setPhase]);

  /** Start a new session, only if nothing unfinished holds the bar. */
  const start = useCallback(async (context: ListenContext, label: string, field?: string) => {
    if (micDecision(occupant(ownership())) === 'refuse') return;
    setSession({ context, label, toField: Boolean(field), field, takes: [], finishing: false });
    await listen(false);
  }, [listen, ownership, setSession]);

  const beginTyped = useCallback(async ({ text, context, label }: WaitingNote) => {
    setSession({ context, label, toField: false, takes: [{ localId: crypto.randomUUID(), recordingId: 'typed', seconds: 0, text }], finishing: true });
    await process();
  }, [process, setSession]);

  // The bar has come free (or the app reopened with it free): the next typed note goes.
  useEffect(() => {
    const next = nextInLine(ownership(), waitingNow.current);
    if (!next) return;
    void beginTyped(next);
    setWaiting(waitingNow.current.slice(1));
  }, [phase, session, waiting, ownership, beginTyped, setWaiting]);

  const offerField = useCallback((field: string, into: FieldTaker) => {
    fields.current.set(field, into);
    setFieldsOffered(n => n + 1);
    return () => { if (fields.current.get(field) === into) fields.current.delete(field); };
  }, []);

  // A field has come back: words the bar was holding for it go in now.
  useEffect(() => {
    if (phase === 'words') void settleField();
  }, [phase, fieldsOffered, settleField]);

  return {
    phase, status, error, pause, proposal, session, waiting, seconds: recorder.seconds, remaining: recorder.remaining,
    /** What holds the bar right now, if anything does. */
    holding: occupant({ phase, session, starting: false }) === 'none' ? null : session?.label ?? 'Your last dictation',
    start,
    offerField,
    stop: recorder.stop,
    /** Stop listening and drop this take; earlier takes stay. */
    cancelTake: async () => {
      recorder.discard();
      if (current.current?.takes.length) { update(s => ({ ...s, finishing: false })); setPhase('paused'); setPause(null); }
      else await clear();
    },
    /** Another take of this session, from the paused bar or the review. */
    keepGoing: () => (current.current && canKeepGoing(phaseNow.current) && !starting.current ? listen(true) : Promise.resolve()),
    done: () => { update(s => ({ ...s, finishing: true })); return process(); },
    retry: () => process(),
    discard: () => clear(),
    send: async (text: string, context: ListenContext, label: string) => {
      const note = { text, context, label };
      if (typedDecision(occupant(ownership())) === 'wait') setWaiting([...waitingNow.current, note]);
      else await beginTyped(note);
    },
  };
}

async function discardRecordings(session: Session | null): Promise<void> {
  for (const take of session?.takes ?? []) {
    await localAudio.remove(take.localId);
    if (take.recordingId && take.recordingId !== 'typed') await api.discardRecording(take.recordingId).catch(() => {});
  }
}
