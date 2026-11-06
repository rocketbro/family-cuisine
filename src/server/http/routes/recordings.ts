// Dictation recordings: save the original first, then transcribe it; a failed one stays for
// Retry and can be downloaded or discarded.
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Deps } from '../../application/deps.ts';
import { keepRecording, transcribeRecording } from '../../application/recordings.ts';
import { files, formText } from '../validate.ts';
import { audioContentType } from '../../../domain/audio-format.ts';

export function recordingRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(deps.recordings.list()))
    .post('/', async c => {
      const [audio] = await files(c, 'audio', 1);
      if (!audio) throw new HTTPException(400, { message: 'No recording came through.' });
      return c.json(keepRecording(deps, audio.data, (await formText(c, 'label')) ?? 'Dictation'));
    })
    .post('/:id/transcribe', async c => c.json(await transcribeRecording(deps, c.req.param('id'))))
    .get('/:id/audio', c => {
      const audio = deps.recordings.audio(c.req.param('id'));
      if (!audio) return c.notFound();
      return c.body(new Uint8Array(audio.data), 200, {
        'Content-Type': audioContentType(audio.extension),
        'Content-Disposition': `attachment; filename="cuisine-dictation.${audio.extension}"`,
      });
    })
    .delete('/:id', c => {
      deps.recordings.remove(c.req.param('id'));
      return c.json({ ok: true });
    });
}
