import { describe, expect, it } from 'vitest';
import { fieldOutcome, handOver, NOTHING_HEARD, restoredMessage, restoredPhase, type FieldLanding } from './field-words.ts';
import type { Session, Take } from './session.ts';

const spoken = (text: string | null): Take => ({ localId: 'a', recordingId: 'rec-1', seconds: 12, text });
const typed: Take = { localId: 'b', recordingId: 'typed', seconds: 0, text: 'used the yogurt' };
const fieldSession = (takes: Take[], over: Partial<Session> = {}): Session => ({
  context: { kind: 'anywhere' }, label: 'How you cook', toField: true, field: 'kitchen-notes', takes, finishing: true, ...over,
});
const noteSession = (takes: Take[]): Session => ({ context: { kind: 'pantry' }, label: 'Pantry', toField: false, takes, finishing: true });

describe('fieldOutcome', () => {
  it('lands only in a field that is on screen', () => {
    expect(fieldOutcome('butter, never margarine', true)).toBe('land');
  });

  it('holds the words when the field is gone, rather than handing them to nothing', () => {
    expect(fieldOutcome('butter, never margarine', false)).toBe('hold');
  });

  it('never lets audio go on words nobody heard, field or no field', () => {
    expect(fieldOutcome('', true)).toBe('nothing-heard');
    expect(fieldOutcome('', false)).toBe('nothing-heard');
    expect(NOTHING_HEARD).toContain('didn’t catch');
  });
});

describe('handOver', () => {
  it('lands at once in a field that just takes the words', async () => {
    const took: string[] = [];
    await expect(handOver(text => { took.push(text); }, 'half a cup')).resolves.toEqual({ kind: 'landed' });
    expect(took).toEqual(['half a cup']);
  });

  it('isn’t landed until a field that has work to do says so', async () => {
    let answer = (_landing: FieldLanding) => {};
    let settled = false;
    const handing = handOver(() => new Promise<FieldLanding>(resolve => { answer = resolve; }), 'double the garlic').then(result => { settled = true; return result; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    answer('in');
    await expect(handing).resolves.toEqual({ kind: 'landed' });
  });

  it('holds the words if the field left before it finished', async () => {
    await expect(handOver(async (): Promise<FieldLanding> => 'gone', 'double the garlic')).resolves.toEqual({ kind: 'held' });
  });

  it('keeps the words when the field fails, with its plain message', async () => {
    const take = async (): Promise<FieldLanding> => { throw new Error('Claude is busy right now.'); };
    await expect(handOver(take, 'double the garlic')).resolves.toEqual({ kind: 'failed', message: 'Claude is busy right now.' });
  });
});

describe('after a reload', () => {
  it('comes back free with nothing saved', () => {
    expect(restoredPhase(null)).toBe('idle');
    expect(restoredMessage(null)).toBeNull();
  });

  it('puts a field’s finished words straight back on the bar, not behind Retry', () => {
    const session = fieldSession([spoken('half a cup')]);
    expect(restoredPhase(session)).toBe('words');
    expect(restoredMessage(session)).toBeNull();
  });

  it('holds words from a session saved before fields had names too', () => {
    expect(restoredPhase(fieldSession([spoken('half a cup')], { field: undefined }))).toBe('words');
  });

  it('lands on Retry while a field’s words are still on their way', () => {
    expect(restoredPhase(fieldSession([spoken(null)]))).toBe('failed');
    expect(restoredPhase(fieldSession([spoken('half a cup'), spoken(null)]))).toBe('failed');
    expect(restoredPhase(fieldSession([spoken('half a cup')], { finishing: false }))).toBe('failed');
    expect(restoredPhase(fieldSession([spoken('')]))).toBe('failed');
  });

  it('lands on Retry for anything meant for the model', () => {
    expect(restoredPhase(noteSession([spoken('half a cup')]))).toBe('failed');
  });

  it('says a recording is saved when there is one', () => {
    expect(restoredMessage(noteSession([spoken(null)]))).toContain('recording is saved');
    expect(restoredMessage(noteSession([typed, spoken('and more')]))).toContain('recording is saved');
  });

  it('doesn’t claim a recording for a typed note', () => {
    const message = restoredMessage(noteSession([typed]));
    expect(message).not.toContain('recording');
    expect(message).toContain('words are saved');
  });
});
