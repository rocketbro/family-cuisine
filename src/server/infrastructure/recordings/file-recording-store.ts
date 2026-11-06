// Dictation originals on the server's disk, one folder each: the audio and a small JSON record.
// They stay until the app says it's done with them, or for a week.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AudioExtension } from '../../../domain/audio-format.ts';
import type { RecordingRecord, RecordingStorePort } from '../../application/ports/recordings.ts';
import { UserError } from '../../application/user-error.ts';

const KEEP_DAYS = 7;
const ID = /^[a-f0-9-]{36}$/;

/** Beyond the port, the file itself, for the transcriber to hand to ffmpeg. */
export type FileRecordingStore = RecordingStorePort & { audioFile(id: string): string | null };

export function fileRecordingStore(root: string): FileRecordingStore {
  const folder = (id: string) => {
    if (!ID.test(id)) throw new UserError('That recording isn’t available.', 404);
    return path.join(root, id);
  };
  const read = (id: string): RecordingRecord | null => {
    try { return JSON.parse(fs.readFileSync(path.join(folder(id), 'recording.json'), 'utf8')) as RecordingRecord; } catch { return null; }
  };
  const audioFile = (id: string) => {
    const record = read(id);
    return record ? path.join(folder(id), record.file) : null;
  };
  const write = (record: RecordingRecord) => {
    const tmp = path.join(folder(record.id), 'recording.tmp');
    fs.writeFileSync(tmp, JSON.stringify(record));
    fs.renameSync(tmp, path.join(folder(record.id), 'recording.json'));
  };

  return {
    save(audio, extension, label) {
      const id = randomUUID();
      const dir = folder(id);
      fs.mkdirSync(dir, { recursive: true });
      const file = `audio.${extension}`;
      fs.writeFileSync(path.join(dir, file), audio);
      const record: RecordingRecord = { id, file, label, createdAt: new Date().toISOString(), text: null, error: null, bytes: audio.length };
      write(record);
      return record;
    },
    get: read,
    audioFile,
    audio(id) {
      const file = audioFile(id);
      if (!file || !fs.existsSync(file)) return null;
      return { data: fs.readFileSync(file), extension: path.extname(file).slice(1) as AudioExtension };
    },
    update(id, patch) {
      const record = read(id);
      if (record) write({ ...record, ...patch });
    },
    list() {
      if (!fs.existsSync(root)) return [];
      return fs.readdirSync(root).filter(n => ID.test(n)).map(read).filter((r): r is RecordingRecord => r !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    remove(id) {
      fs.rmSync(folder(id), { recursive: true, force: true });
    },
    sweep() {
      const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
      let removed = 0;
      for (const record of this.list()) {
        if (new Date(record.createdAt).getTime() < cutoff) { this.remove(record.id); removed += 1; }
      }
      return removed;
    },
  };
}
