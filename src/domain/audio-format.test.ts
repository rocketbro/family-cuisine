import { describe, expect, it } from 'vitest';
import { audioContentType, RECORDINGS_MAX_BYTES, RECORDINGS_MAX_COUNT, roomForRecording, sniffAudio } from './audio-format.ts';

describe('sniffAudio', () => {
  const bytes = (...parts: (number[] | string)[]) => Uint8Array.from(parts.flatMap(p => (typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p)));
  const padded = (...parts: (number[] | string)[]) => bytes(...parts, new Array(12).fill(0));

  it('knows what phones record, whatever a file calls itself', () => {
    expect(sniffAudio(padded([0x1a, 0x45, 0xdf, 0xa3]))?.demuxer).toBe('matroska');
    expect(sniffAudio(padded('OggS'))?.demuxer).toBe('ogg');
    expect(sniffAudio(padded([0, 0, 0, 0x20], 'ftypM4A '))).toMatchObject({ demuxer: 'mov', extension: 'm4a' });
    expect(sniffAudio(padded([0, 0, 0, 0x1c], 'ftypiso5'))).toMatchObject({ demuxer: 'mov' });
    expect(sniffAudio(padded([0, 0, 0, 0x20], 'ftypmp42'))).toMatchObject({ demuxer: 'mov' });
  });

  it('refuses playlists, images, scripts and scraps', () => {
    expect(sniffAudio(padded('#EXTM3U\n'))).toBeNull();
    expect(sniffAudio(padded('<?xml version'))).toBeNull();
    expect(sniffAudio(padded([0xff, 0xd8, 0xff]))).toBeNull();
    expect(sniffAudio(padded([0, 0, 0, 0x18], 'ftypheic'))).toBeNull();
    expect(sniffAudio(padded([0, 0, 0, 0x18], 'ftypmif1'))).toBeNull();
    expect(sniffAudio(bytes('OggS'))).toBeNull();
  });

  it('labels stored recordings by extension', () => {
    expect(audioContentType('m4a')).toBe('audio/mp4');
    expect(audioContentType('mp4')).toBe('audio/mp4');
    expect(audioContentType('ogg')).toBe('audio/ogg');
    expect(audioContentType('webm')).toBe('audio/webm');
  });
});

describe('roomForRecording', () => {
  it('holds to a count and a total size', () => {
    expect(roomForRecording([], 100)).toBe(true);
    expect(roomForRecording(new Array(RECORDINGS_MAX_COUNT).fill(1), 1)).toBe(false);
    expect(roomForRecording([RECORDINGS_MAX_BYTES - 10], 10)).toBe(true);
    expect(roomForRecording([RECORDINGS_MAX_BYTES - 10], 11)).toBe(false);
  });
});
