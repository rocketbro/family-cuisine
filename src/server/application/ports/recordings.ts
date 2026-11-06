import type { AudioExtension } from '../../../domain/audio-format.ts';

/** One saved dictation: the original audio, and its words once transcribed. */
export type RecordingRecord = {
  id: string;
  file: string;
  label: string;
  createdAt: string;
  bytes: number;
  text: string | null;
  /** The last transcription failure, kept so the app can offer Retry. */
  error: string | null;
};

/** Keeps dictation originals until they're no longer needed, so a failure never loses them. */
export type RecordingStorePort = {
  save(audio: Buffer, extension: AudioExtension, label: string): RecordingRecord;
  get(id: string): RecordingRecord | null;
  /** The original audio, or null when it's gone. */
  audio(id: string): { data: Buffer; extension: AudioExtension } | null;
  update(id: string, patch: Partial<Pick<RecordingRecord, 'text' | 'error'>>): void;
  list(): RecordingRecord[];
  remove(id: string): void;
  /** Drops recordings older than a week; returns how many. */
  sweep(): number;
};
