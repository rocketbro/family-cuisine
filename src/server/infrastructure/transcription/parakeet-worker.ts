// Child process: transcribe one 16 kHz WAV with Parakeet and print one JSON line.
// argv: <wav> <modelDir>
import { createRequire } from 'node:module';
import path from 'node:path';

type Sherpa = {
  OfflineRecognizer: new (config: unknown) => {
    createStream(): { acceptWaveform(w: { sampleRate: number; samples: Float32Array }): void };
    decode(stream: unknown): void;
    getResult(stream: unknown): { text?: string };
  };
  readWave(file: string): { sampleRate: number; samples: Float32Array };
};

const [wav, dir] = process.argv.slice(2);
try {
  const sherpa = createRequire(import.meta.url)('sherpa-onnx-node') as Sherpa;
  const recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: path.join(dir, 'encoder.int8.onnx'),
        decoder: path.join(dir, 'decoder.int8.onnx'),
        joiner: path.join(dir, 'joiner.int8.onnx'),
      },
      tokens: path.join(dir, 'tokens.txt'),
      // Required for NeMo transducers; without it sherpa returns empty text instead of failing.
      modelType: 'nemo_transducer',
      numThreads: 4,
      provider: 'cpu',
      debug: false,
    },
  });
  const wave = sherpa.readWave(wav);
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
  recognizer.decode(stream);
  process.stdout.write(JSON.stringify({ ok: true, text: recognizer.getResult(stream).text ?? '' }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: (error as Error).message }));
}
