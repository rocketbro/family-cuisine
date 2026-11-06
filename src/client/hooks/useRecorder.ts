// Records from the microphone, up to a limit (10 minutes), counting down as it goes. iPhones
// record mp4/aac, other browsers webm/opus; the server converts either.
//
// A recording can end three ways, and the caller hears which: you stopped it, it hit the
// limit, or the phone took the microphone away (a call, another app, the screen going off).
// Whatever was recorded up to then is always handed back. The screen stays awake meanwhile.
import { useEffect, useRef, useState } from 'react';

export const RECORDING_LIMIT_SECONDS = 10 * 60;

export type Recording = { blob: Blob; filename: string; seconds: number; ended: 'stopped' | 'limit' | 'interrupted' };

export function useRecorder(onEnded: (recording: Recording) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const why = useRef<Recording['ended']>('stopped');
  const lock = useRef<WakeLockSentinel | null>(null);
  const ended = useRef(onEnded);
  useEffect(() => { ended.current = onEnded; });
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  async function holdScreen() {
    try { lock.current = await navigator.wakeLock?.request('screen') ?? null; } catch { lock.current = null; }
  }

  function finish(reason: Recording['ended']) {
    const r = recorder.current;
    if (!r || r.state === 'inactive') return;
    why.current = reason;
    r.stop();
  }

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= RECORDING_LIMIT_SECONDS) finish('limit');
    }, 250);
    const awake = () => { if (document.visibilityState === 'visible') void holdScreen(); };
    document.addEventListener('visibilitychange', awake);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', awake); };
  }, [recording]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser can’t record. Open Cuisine from the home screen app.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    why.current = 'stopped';
    r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
    // The file is built only once the browser has delivered the last chunk.
    r.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      void lock.current?.release().catch(() => {});
      lock.current = null;
      recorder.current = null;
      setRecording(false);
      const type = (r.mimeType || 'audio/webm').split(';')[0];
      ended.current({
        blob: new Blob(chunks.current, { type }),
        filename: `dictation.${type.includes('mp4') ? 'm4a' : 'webm'}`,
        seconds: Math.round((Date.now() - started.current) / 1000),
        ended: why.current,
      });
    };
    for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => finish('interrupted'));
      // A call mutes the track and the recorder would go on taking silence. A mute that lasts
      // is an interruption; a blip (headphones plugged in) is not.
      const muted = { timer: 0 };
      track.addEventListener('mute', () => { clearTimeout(muted.timer); muted.timer = window.setTimeout(() => { if (track.muted) finish('interrupted'); }, 1500); });
      track.addEventListener('unmute', () => clearTimeout(muted.timer));
    }
    r.start(1000);
    recorder.current = r;
    started.current = Date.now();
    setSeconds(0);
    setRecording(true);
    void holdScreen();
  };

  /** Stop and keep what was said (it arrives through onEnded). */
  const stop = () => finish('stopped');

  /** Stop and throw it away. */
  const discard = () => {
    const r = recorder.current;
    if (!r) return;
    r.onstop = () => {
      r.stream.getTracks().forEach(t => t.stop());
      void lock.current?.release().catch(() => {});
      recorder.current = null;
      setRecording(false);
    };
    r.stop();
  };

  return { recording, seconds, remaining: Math.max(0, RECORDING_LIMIT_SECONDS - seconds), start, stop, discard };
}
