// Dictation, kept safe: the recording is saved on the server first, then transcribed. If
// transcription fails, the original stays for Retry, even after a reload, until the app is done
// with it or a week passes. A refused upload stays on the phone, which keeps it until the server has it.
import { roomForRecording, sniffAudio } from '../../domain/audio-format.ts';
import type { Deps } from './deps.ts';
import type { RecordingRecord } from './ports/recordings.ts';
import { UserError } from './user-error.ts';

/** Nothing on this server can do the work (no ffmpeg, or no speech engine): Retry won't help. */
export class DictationNotSetUp extends Error {}

const hasRoom = (deps: Deps, bytes: number) => roomForRecording(deps.recordings.list().map(r => r.bytes), bytes);

export function keepRecording(deps: Deps, audio: Buffer, label: string): RecordingRecord {
  if (!audio.length) throw new UserError('No sound came through. Try again a little closer to the phone.');
  const format = sniffAudio(audio);
  if (!format) throw new UserError('That recording isn’t a kind Cuisine can read (WebM, Ogg or M4A only).', 415);
  if (!hasRoom(deps, audio.length)) {
    deps.recordings.sweep();
    if (!hasRoom(deps, audio.length)) throw new UserError('The server has too many unfinished recordings to take another. Finish or discard some, then tap Retry.', 507);
  }
  return deps.recordings.save(audio, format.extension, label.slice(0, 200));
}

export async function transcribeRecording(deps: Deps, id: string): Promise<{ text: string }> {
  const record = deps.recordings.get(id);
  if (!record) throw new UserError('That recording is gone (they’re kept for a week).', 404);
  if (record.text !== null) return { text: record.text };
  try {
    const text = (await deps.transcriber.transcribe(id)).trim();
    deps.recordings.update(id, { text, error: null });
    return { text };
  } catch (e) {
    // The record is served to the app, and the real reason can hold paths: that goes to the log.
    deps.recordings.update(id, { error: 'Couldn’t transcribe it.' });
    deps.log(`transcription failed for recording ${id}: ${(e as Error).message}`);
    if (e instanceof DictationNotSetUp) throw new UserError('Dictation isn’t set up on this server yet, so type it instead for now. The recording is kept for a week; the README explains the setup.', 503);
    throw new UserError('Couldn’t transcribe it just now. The recording is safe on the server; tap Retry.', 503);
  }
}
