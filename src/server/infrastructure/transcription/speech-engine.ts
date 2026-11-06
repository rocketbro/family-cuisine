/**
 * One way of turning speech into words, for the transcriber to try in turn. This is the
 * transcriber's own seam, not an application port: it takes a WAV file on disk, and no use case sees it.
 */
export type SpeechEngine = { name: string; available(): Promise<boolean>; transcribe(wav: string): Promise<string> };
