import { describe, expect, it } from 'vitest';
import { canKeepGoing, micDecision, nextInLine, occupant, restoredSession, typedDecision, type Ownership, type WaitingNote } from './ownership.ts';
import type { Session, Take } from './session.ts';
import type { DictationPhase } from './useDictation.ts';

const take: Take = { localId: 'a', recordingId: null, seconds: 12, text: null };
const session = (takes: Take[]): Session => ({ context: { kind: 'pantry' }, label: 'Pantry', toField: false, takes, finishing: false });
const state = (phase: DictationPhase, over: Partial<Ownership> = {}): Ownership => ({ phase, session: session([take]), starting: false, ...over });
const note: WaitingNote = { text: 'used yogurt', context: { kind: 'pantry' }, label: 'Notes on soup' };

describe('occupant', () => {
  it('is free with no session', () => {
    expect(occupant(state('idle', { session: null }))).toBe('none');
  });

  it('counts a session with audio as unfinished in every resting phase', () => {
    for (const phase of ['failed', 'paused', 'review'] as const) expect(occupant(state(phase))).toBe('unfinished');
  });

  it('holds the bar while listening or working, even before the first take is in', () => {
    expect(occupant(state('listening', { session: session([]) }))).toBe('listening');
    expect(occupant(state('working'))).toBe('working');
  });

  it('holds the bar while the mic is being asked for, so a second tap or a note can’t slip in', () => {
    expect(occupant(state('idle', { session: session([]), starting: true }))).toBe('listening');
  });

  it('treats words held for a field as unfinished', () => {
    expect(occupant(state('words'))).toBe('unfinished');
  });

  it('lets a mic that failed to start be replaced, since it holds no audio', () => {
    expect(occupant(state('error', { session: session([]) }))).toBe('none');
  });
});

describe('new requests', () => {
  it('begin only when the bar is free', () => {
    expect(micDecision('none')).toBe('begin');
    expect(typedDecision('none')).toBe('begin');
  });

  it('never replace anything: the mic is refused, typed words wait', () => {
    for (const holder of ['listening', 'working', 'unfinished'] as const) {
      expect(micDecision(holder)).toBe('refuse');
      expect(typedDecision(holder)).toBe('wait');
    }
  });
});

describe('nextInLine', () => {
  it('goes first in, first out once the bar is free', () => {
    const later = { ...note, label: 'Later' };
    expect(nextInLine(state('idle', { session: null }), [note, later])).toBe(note);
  });

  it('has nothing to send from an empty line', () => {
    expect(nextInLine(state('idle', { session: null }), [])).toBeNull();
  });

  it('waits behind unfinished work', () => {
    for (const phase of ['listening', 'working', 'paused', 'failed', 'review'] as const) {
      expect(nextInLine(state(phase), [note])).toBeNull();
    }
  });

  it('waits behind words held for a field and a mic error still on screen', () => {
    expect(nextInLine(state('words'), [note])).toBeNull();
    expect(nextInLine(state('error', { session: session([]) }), [note])).toBeNull();
  });

  it('waits while "Save and answer" is starting its mic', () => {
    expect(nextInLine(state('idle', { session: session([]), starting: true }), [note])).toBeNull();
  });
});

describe('canKeepGoing', () => {
  it('adds a take only to a paused or reviewed session', () => {
    expect(canKeepGoing('paused')).toBe(true);
    expect(canKeepGoing('review')).toBe(true);
    for (const phase of ['idle', 'listening', 'working', 'failed', 'words', 'error'] as const) expect(canKeepGoing(phase)).toBe(false);
  });
});

describe('restoredSession', () => {
  it('keeps a session with takes', () => {
    const saved = session([take]);
    expect(restoredSession(saved)).toBe(saved);
  });

  it('drops one with no audio, and nothing stays nothing', () => {
    expect(restoredSession(session([]))).toBeNull();
    expect(restoredSession(null)).toBeNull();
  });
});
