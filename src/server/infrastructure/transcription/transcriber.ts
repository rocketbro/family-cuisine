// Tries each speech engine in order for the whole recording. A failure on any piece
// drops that engine's output entirely, so a transcript is never half one engine, half another.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TranscriberPort } from '../../application/ports/transcription.ts';
import { DictationNotSetUp } from '../../application/recordings.ts';
import { toWavSegments } from './audio.ts';
import type { SpeechEngine } from './speech-engine.ts';

export function ladderTranscriber(opts: {
  audioFile: (recordingId: string) => string | null; ffmpeg: string; tmpDir: string; segmentSeconds: number;
  engines: SpeechEngine[];
}): TranscriberPort {
  return {
    async transcribe(recordingId) {
      const workDir = path.join(opts.tmpDir, `wav-${Date.now()}`);
      try {
        const audioPath = opts.audioFile(recordingId);
        if (!audioPath) throw new Error(`Recording ${recordingId} is gone.`);
        const parts = await toWavSegments(opts.ffmpeg, audioPath, workDir, opts.segmentSeconds).catch((error: NodeJS.ErrnoException) => {
          // Only ffmpeg itself being missing. A recording that's gone also says ENOENT, and that isn't setup.
          throw error.code === 'ENOENT' && error.syscall?.startsWith('spawn') ? new DictationNotSetUp(`ffmpeg not found at "${opts.ffmpeg}"`) : error;
        });
        const failures: string[] = [];
        let tried = false;
        for (const engine of opts.engines) {
          if (!(await engine.available())) {
            failures.push(`${engine.name}: not available`);
            continue;
          }
          tried = true;
          try {
            const texts = [];
            for (const part of parts) texts.push(await engine.transcribe(part));
            const text = texts.join(' ').replace(/\s+/g, ' ').trim();
            if (text) return text;
            failures.push(`${engine.name}: heard nothing`);
          } catch (error) {
            failures.push(`${engine.name}: ${(error as Error).message}`);
          }
        }
        const problem = `Couldn't transcribe the recording (${failures.join('; ')}).`;
        throw tried ? new Error(problem) : new DictationNotSetUp(problem);
      } finally {
        await fs.rm(workDir, { recursive: true, force: true });
      }
    },
  };
}
