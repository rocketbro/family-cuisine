import { describe, expect, it } from 'vitest';
import { RECORDINGS_MAX_COUNT } from '../../domain/audio-format.ts';
import { M4A_BYTES, memoryRecordings, OGG_BYTES, WEBM_BYTES } from './test-support/recording-fakes.ts';
import { runDueJobs, type Schedule } from './jobs.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';
import type { RecordingRecord } from './ports/recordings.ts';
import { keepRecording, transcribeRecording } from './recordings.ts';
import { UserError } from './user-error.ts';

const house = (records: RecordingRecord[] = []) => {
  const deps = fakeDeps({ ai: false });
  const recordings = memoryRecordings(records);
  deps.recordings = recordings;
  return { deps, recordings };
};
const old = (id: number): RecordingRecord => ({ id: String(id), file: 'audio.webm', label: 'x', createdAt: '2026-01-01T00:00:00Z', bytes: 1, text: null, error: null });

describe('keepRecording', () => {
  it.each([[WEBM_BYTES, 'audio.webm'], [M4A_BYTES, 'audio.m4a'], [OGG_BYTES, 'audio.ogg']])('names the file from its bytes', (bytes, file) => {
    expect(keepRecording(house().deps, bytes, 'Dictation').file).toBe(file);
  });

  it('refuses what isn’t audio, with a reason for the person holding the phone', () => {
    const { deps, recordings } = house();
    expect(() => keepRecording(deps, Buffer.from('#EXTM3U\nhttp://169.254.169.254/\n'), 'x')).toThrowError(expect.objectContaining({ status: 415, name: 'UserError' }));
    expect(recordings.records).toHaveLength(0);
  });

  it('asks the store to clear old ones first, then refuses only if there’s still no room', () => {
    const { deps, recordings } = house(Array.from({ length: RECORDINGS_MAX_COUNT }, (_, i) => old(i)));
    expect(() => keepRecording(deps, WEBM_BYTES, 'x')).toThrowError(expect.objectContaining({ status: 507 }));
    expect(recordings.swept).toBe(1);
  });
});

describe('transcribeRecording', () => {
  it('keeps internal details out of the record the app can read', async () => {
    const { deps, recordings } = house();
    const record = recordings.save(WEBM_BYTES, 'webm', 'x');
    deps.transcriber = { transcribe: () => Promise.reject(new Error('ffmpeg failed on /Users/someone/secret/path')) };
    await expect(transcribeRecording(deps, record.id)).rejects.toBeInstanceOf(UserError);
    expect(recordings.get(record.id)?.error).not.toContain('/Users');
    expect(deps.logged.some(line => line.includes('/Users/someone'))).toBe(true);
  });
});

describe('the daily recording sweep', () => {
  // 2026-11-08 is a Sunday; the schedule keeps every other job quiet where it can.
  const schedule: Schedule = { planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 23, minute: 59 } };

  it('runs once a day without a restart', async () => {
    const { deps, recordings } = house();
    await runDueJobs(deps, schedule, new Date('2026-11-08T04:00:00'));
    await runDueJobs(deps, schedule, new Date('2026-11-08T05:00:00'));
    expect(recordings.swept).toBe(1);
    await runDueJobs(deps, schedule, new Date('2026-11-09T04:00:00'));
    expect(recordings.swept).toBe(2);
  });

  it('tries again later the same day when it fails', async () => {
    const { deps, recordings } = house();
    const works = recordings.sweep;
    recordings.sweep = () => { throw new Error('disk gone'); };
    await runDueJobs(deps, schedule, new Date('2026-11-08T04:00:00'));
    recordings.sweep = works;
    await runDueJobs(deps, schedule, new Date('2026-11-08T04:06:00'));
    expect(recordings.swept).toBe(1);
  });
});
