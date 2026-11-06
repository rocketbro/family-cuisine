// Phone recordings arrive as webm, ogg or mp4; both speech engines want 16 kHz mono WAV, and
// FluidVoice caps one request, so long walk-throughs are cut into pieces first. ffmpeg reads
// these untrusted files with the demuxer forced and only the file protocol, so a file can't
// choose a parser (say, a playlist that fetches URLs) by what it claims to be.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { AUDIO_HEADER_BYTES, sniffAudio } from '../../../domain/audio-format.ts';

const run = promisify(execFile);

async function formatOf(input: string) {
  const file = await fs.open(input);
  try {
    const { buffer } = await file.read(Buffer.alloc(AUDIO_HEADER_BYTES), 0, AUDIO_HEADER_BYTES, 0);
    const format = sniffAudio(buffer);
    if (!format) throw new Error('The recording is not WebM, Ogg or MP4 audio.');
    return format;
  } finally {
    await file.close();
  }
}

export async function toWavSegments(ffmpeg: string, input: string, workDir: string, segmentSeconds: number): Promise<string[]> {
  const format = await formatOf(input);
  await fs.mkdir(workDir, { recursive: true });
  const pattern = path.join(workDir, 'part-%03d.wav');
  await run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-protocol_whitelist', 'file', '-f', format.demuxer, '-i', input,
    '-vn', '-sn', '-dn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    '-f', 'segment', '-segment_time', String(segmentSeconds), pattern,
  ], { timeout: 120_000 });
  const parts = (await fs.readdir(workDir)).filter(f => f.startsWith('part-')).sort();
  if (!parts.length) throw new Error('The recording had no audio.');
  return parts.map(f => path.join(workDir, f));
}
