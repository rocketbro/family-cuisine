// Which recordings the app takes in, judged by their first bytes and never by a filename: what
// phones' MediaRecorder produces. iPhone Safari records MP4/M4A; others record WebM or Ogg.

export type AudioExtension = 'webm' | 'm4a' | 'ogg';
/** `demuxer` is what ffmpeg is told to use, so a file can't choose its own parser. */
export type AudioFormat = { extension: AudioExtension; demuxer: 'matroska' | 'mov' | 'ogg'; contentType: string };

const WEBM: AudioFormat = { extension: 'webm', demuxer: 'matroska', contentType: 'audio/webm' };
const MP4: AudioFormat = { extension: 'm4a', demuxer: 'mov', contentType: 'audio/mp4' };
const OGG: AudioFormat = { extension: 'ogg', demuxer: 'ogg', contentType: 'audio/ogg' };

/** MP4's container is shared with still images; a photo isn't a recording. */
const IMAGE_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis']);

/** How many leading bytes `sniffAudio` needs. */
export const AUDIO_HEADER_BYTES = 12;

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

export function sniffAudio(bytes: Uint8Array): AudioFormat | null {
  if (bytes.length < AUDIO_HEADER_BYTES) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return WEBM;
  if (ascii(bytes, 0, 4) === 'OggS') return OGG;
  if (ascii(bytes, 4, 8) === 'ftyp' && !IMAGE_BRANDS.has(ascii(bytes, 8, 12).trim().toLowerCase())) return MP4;
  return null;
}

/** What to label a stored recording as, from its extension (older ones may be `.mp4`). */
export function audioContentType(extension: string): string {
  if (extension === 'm4a' || extension === 'mp4') return MP4.contentType;
  return extension === 'ogg' ? OGG.contentType : WEBM.contentType;
}

/** Plenty for unfinished dictation, and small enough to protect the disk. */
export const RECORDINGS_MAX_COUNT = 300;
export const RECORDINGS_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export function roomForRecording(existingBytes: number[], incoming: number): boolean {
  if (existingBytes.length >= RECORDINGS_MAX_COUNT) return false;
  return existingBytes.reduce((sum, bytes) => sum + bytes, 0) + incoming <= RECORDINGS_MAX_BYTES;
}
