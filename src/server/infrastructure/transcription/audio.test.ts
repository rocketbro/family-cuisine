import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WEBM_BYTES } from '../../application/test-support/recording-fakes.ts';
import { fileRecordingStore } from '../recordings/file-recording-store.ts';
import { toWavSegments } from './audio.ts';

const FFMPEG = '/opt/homebrew/bin/ffmpeg';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-audio-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Stands in for ffmpeg, noting how it was called. */
function recordingFfmpeg(): { program: string; args: () => string[] } {
  const log = path.join(dir, 'args.txt');
  const program = path.join(dir, 'fake-ffmpeg');
  fs.writeFileSync(program, `#!/bin/bash\nprintf '%s\\n' "$@" > '${log}'\ntouch "$(dirname "\${@: -1}")/part-000.wav"\n`, { mode: 0o755 });
  return { program, args: () => fs.readFileSync(log, 'utf8').trim().split('\n') };
}

describe('how ffmpeg is called', () => {
  it('forces the demuxer from the bytes, allows only files, and drops everything but audio', async () => {
    const fake = recordingFfmpeg();
    const input = path.join(dir, 'audio.m4a');
    fs.writeFileSync(input, WEBM_BYTES); // the extension says one thing and the bytes another
    await toWavSegments(fake.program, input, path.join(dir, 'work'), 280);
    const args = fake.args();
    expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('file');
    expect(args[args.indexOf('-f') + 1]).toBe('matroska');
    expect(args.indexOf('-protocol_whitelist')).toBeLessThan(args.indexOf('-i'));
    expect(args.indexOf('-f')).toBeLessThan(args.indexOf('-i'));
    expect(args).toContain('-vn');
  });

  it('never hands ffmpeg a file that isn’t audio', async () => {
    const fake = recordingFfmpeg();
    const input = path.join(dir, 'audio.webm');
    fs.writeFileSync(input, '#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\nhttp://169.254.169.254/latest\n');
    await expect(toWavSegments(fake.program, input, path.join(dir, 'work'), 280)).rejects.toThrow('not WebM');
    expect(fs.existsSync(path.join(dir, 'args.txt'))).toBe(false);
  });
});

describe.skipIf(!fs.existsSync(FFMPEG))('real recordings through ffmpeg', () => {
  // The formats phones record: iPhone Safari's AAC in M4A or MP4, Opus in WebM, and Ogg.
  it.each([
    ['m4a', 'aac', 'ipod'], ['mp4', 'aac', 'mp4'], ['webm', 'libopus', 'webm'], ['ogg', 'libopus', 'ogg'],
  ])('turns %s into WAV', async (extension, codec, muxer) => {
    const input = path.join(dir, `sample.${extension}`);
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', codec, '-f', muxer, input]);
    const parts = await toWavSegments(FFMPEG, input, path.join(dir, 'work'), 280);
    expect(parts).toHaveLength(1);
    expect(fs.readFileSync(parts[0]).subarray(0, 4).toString()).toBe('RIFF');
  });
});

describe('the recording store', () => {
  it('uses the extension it’s given, leaving nothing of a client filename in the path', () => {
    const store = fileRecordingStore(path.join(dir, 'recordings'));
    const record = store.save(WEBM_BYTES, 'webm', 'Dictation');
    expect(record.file).toBe('audio.webm');
    expect(fs.existsSync(store.audioFile(record.id)!)).toBe(true);
  });
});
