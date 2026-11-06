// Fallback: Parakeet TDT 0.6B v3 through sherpa-onnx, run in a child process so the large
// model graph is loaded only while transcribing and never stays resident in the server.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { SpeechEngine } from './speech-engine.ts';

const run = promisify(execFile);
const WORKER = path.join(import.meta.dirname, 'parakeet-worker.ts');

export function parakeetEngine(modelDir: string): SpeechEngine {
  return {
    name: 'Parakeet',
    available: async () => fs.existsSync(path.join(modelDir, 'encoder.int8.onnx')),
    async transcribe(wav) {
      const { stdout } = await run(process.execPath, [WORKER, wav, modelDir], { timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
      const result = JSON.parse(stdout) as { ok: boolean; text?: string; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Parakeet failed');
      return (result.text ?? '').trim();
    },
  };
}
