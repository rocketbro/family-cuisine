// FluidVoice's loopback API, for a server that also runs that Mac dictation app. Only up while
// the app runs (and with LocalAPIEnabled), so it is probed each time and quietly skipped when absent.
import type { SpeechEngine } from './speech-engine.ts';

export function fluidvoiceEngine(baseUrl: string): SpeechEngine {
  return {
    name: 'FluidVoice',
    async available() {
      try {
        return (await fetch(`${baseUrl}/v1/health`, { signal: AbortSignal.timeout(1500) })).ok;
      } catch {
        return false;
      }
    },
    async transcribe(wav) {
      const response = await fetch(`${baseUrl}/v1/transcribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: wav }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error(`FluidVoice returned HTTP ${response.status}`);
      const body = (await response.json()) as { text?: unknown };
      return String(body.text ?? '').trim();
    },
  };
}
