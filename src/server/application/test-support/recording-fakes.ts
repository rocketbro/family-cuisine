// In-memory recording store for tests of uploads and retention, and sample bytes for each format.
import type { AudioExtension } from '../../../domain/audio-format.ts';
import type { RecordingRecord, RecordingStorePort } from '../ports/recordings.ts';

export const WEBM_BYTES = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01]);
export const M4A_BYTES = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A \0\0\0\0isom')]);
export const OGG_BYTES = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(12)]);

export type MemoryRecordings = RecordingStorePort & { records: RecordingRecord[]; swept: number };

export function memoryRecordings(records: RecordingRecord[] = []): MemoryRecordings {
  const audio = new Map<string, Buffer>();
  const store: MemoryRecordings = {
    records,
    swept: 0,
    save(data, extension, label) {
      const record: RecordingRecord = { id: String(records.length), file: `audio.${extension}`, label, createdAt: '2026-11-08T00:00:00.000Z', bytes: data.length, text: null, error: null };
      records.push(record);
      audio.set(record.id, data);
      return record;
    },
    get: id => records.find(r => r.id === id) ?? null,
    audio(id) {
      const data = audio.get(id);
      const file = records.find(r => r.id === id)?.file;
      return data && file ? { data, extension: file.split('.').pop() as AudioExtension } : null;
    },
    update(id, patch) {
      const record = records.find(r => r.id === id);
      if (record) Object.assign(record, patch);
    },
    list: () => records,
    remove(id) {
      const index = records.findIndex(r => r.id === id);
      if (index >= 0) records.splice(index, 1);
    },
    sweep() {
      store.swept += 1;
      return 0;
    },
  };
  return store;
}
