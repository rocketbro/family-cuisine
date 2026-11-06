import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileRecordingStore } from './file-recording-store.ts';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-recordings-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const AUDIO = Buffer.from('some audio');

describe('a kept recording', () => {
  it('gives back its audio and what kind it is', () => {
    const store = fileRecordingStore(dir);
    const { id } = store.save(AUDIO, 'm4a', 'Pantry');
    const audio = store.audio(id);
    expect(audio?.data.equals(AUDIO)).toBe(true);
    expect(audio?.extension).toBe('m4a');
  });

  it('points the transcriber at the file itself', () => {
    const store = fileRecordingStore(dir);
    const { id } = store.save(AUDIO, 'webm', 'Pantry');
    expect(fs.readFileSync(store.audioFile(id)!).equals(AUDIO)).toBe(true);
  });

  it('has no audio once removed, or when only its file is gone', () => {
    const store = fileRecordingStore(dir);
    const removed = store.save(AUDIO, 'webm', 'Pantry').id;
    store.remove(removed);
    expect(store.audio(removed)).toBeNull();
    expect(store.audioFile(removed)).toBeNull();
    const fileGone = store.save(AUDIO, 'webm', 'Pantry').id;
    fs.rmSync(store.audioFile(fileGone)!);
    expect(store.audio(fileGone)).toBeNull();
  });

  it('reads nothing for an ID that climbs out of its folder', () => {
    const store = fileRecordingStore(dir);
    expect(store.audio('../outside')).toBeNull();
    expect(store.audioFile('../outside')).toBeNull();
  });
});
