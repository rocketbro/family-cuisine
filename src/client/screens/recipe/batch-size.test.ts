import { describe, expect, it } from 'vitest';
import { attempt, type Failure } from '../../hooks/useWrite.ts';
import { batchSizeChanger } from './batch-size.ts';

function setup() {
  const state = { shown: 1, failure: null as Failure | null };
  const change = batchSizeChanger(1, size => { state.shown = size; }, write => attempt(write, f => { state.failure = f; }));
  return { state, change };
}

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('batchSizeChanger', () => {
  it('moves at once and stays when the save lands', async () => {
    const { state, change } = setup();
    const save = deferred();
    const done = change(2, () => save.promise);
    expect(state.shown).toBe(2);
    save.resolve();
    await done;
    expect(state).toMatchObject({ shown: 2, failure: null });
  });

  it('goes back and reports it when the save fails, rather than an unhandled rejection', async () => {
    const { state, change } = setup();
    await expect(change(2, () => Promise.reject(new Error('No signal')))).resolves.toBeUndefined();
    expect(state.shown).toBe(1);
    expect(state.failure?.message).toBe('No signal');
  });

  it('goes back to the last size that saved, not the one before it', async () => {
    const { state, change } = setup();
    await change(2, () => Promise.resolve());
    await change(3, () => Promise.reject(new Error('No signal')));
    expect(state.shown).toBe(2);
  });

  it('moves again when Try again lands', async () => {
    const { state, change } = setup();
    let online = false;
    const save = () => (online ? Promise.resolve() : Promise.reject(new Error('No signal')));
    await change(2, save);
    expect(state.shown).toBe(1);
    online = true;
    state.failure!.retry();
    await new Promise(resolve => setTimeout(resolve));
    expect(state).toMatchObject({ shown: 2, failure: null });
  });

  it('leaves a later tap alone when an earlier save fails', async () => {
    const { state, change } = setup();
    const first = deferred();
    const firstDone = change(2, () => first.promise);
    await change(3, () => Promise.resolve());
    first.reject(new Error('No signal'));
    await firstDone;
    expect(state.shown).toBe(3);
  });

  it('just changes the size of a recipe that isn’t planned', async () => {
    const { state, change } = setup();
    await change(0.5, null);
    expect(state).toMatchObject({ shown: 0.5, failure: null });
  });
});
