import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DictationNotSetUp, transcribeRecording } from '../../application/recordings.ts';
import type { Deps } from '../../application/deps.ts';
import { WEBM_BYTES } from '../../application/test-support/recording-fakes.ts';
import { ladderTranscriber } from './transcriber.ts';

let dir: string;
let audio: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-dictation-'));
  audio = path.join(dir, 'audio.webm');
  fs.writeFileSync(audio, WEBM_BYTES);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Stands in for ffmpeg: writes one piece of audio to the segment pattern it was given. */
function fakeFfmpeg(): string {
  const file = path.join(dir, 'ffmpeg');
  fs.writeFileSync(file, '#!/bin/sh\nfor last; do :; done\nprintf x > "$(printf "$last" 0)"\n', { mode: 0o755 });
  return file;
}
const transcriber = (ffmpeg: string, engines: Parameters<typeof ladderTranscriber>[0]['engines']) =>
  ladderTranscriber({ audioFile: file => file, ffmpeg, tmpDir: dir, segmentSeconds: 280, engines });
const absent = { name: 'None', available: async () => false, transcribe: async () => '' };

describe('a server without dictation set up', () => {
  it('says so when ffmpeg is missing', async () => {
    await expect(transcriber(path.join(dir, 'no-ffmpeg'), [absent]).transcribe(audio)).rejects.toBeInstanceOf(DictationNotSetUp);
  });
  it('says so when no speech engine is available', async () => {
    await expect(transcriber(fakeFfmpeg(), [absent]).transcribe(audio)).rejects.toBeInstanceOf(DictationNotSetUp);
  });
  it('still offers Retry when an engine is there and fails', async () => {
    const failing = { name: 'Flaky', available: async () => true, transcribe: async () => { throw new Error('busy'); } };
    const error = await transcriber(fakeFfmpeg(), [failing]).transcribe(audio).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(DictationNotSetUp);
  });
  it('doesn’t blame setup for a recording that’s gone', async () => {
    const error = await transcriber(fakeFfmpeg(), [absent]).transcribe(path.join(dir, 'gone.webm')).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(DictationNotSetUp);
  });
  it('doesn’t blame setup for a recording the store no longer has', async () => {
    const error = await ladderTranscriber({ audioFile: () => null, ffmpeg: fakeFfmpeg(), tmpDir: dir, segmentSeconds: 280, engines: [absent] }).transcribe('id').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(DictationNotSetUp);
  });
  it('tells the person plainly, instead of asking them to retry', async () => {
    const deps = {
      recordings: { get: () => ({ text: null }), update: () => undefined },
      transcriber: { transcribe: () => Promise.reject(new DictationNotSetUp('no engine')) },
      log: () => undefined,
    } as unknown as Deps;
    await expect(transcribeRecording(deps, 'id')).rejects.toThrowError(expect.objectContaining({ status: 503, name: 'UserError', message: expect.stringContaining('isn’t set up on this server') }));
  });
});
