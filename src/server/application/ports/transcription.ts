export type TranscriberPort = {
  /** Reads a kept recording, by its ID in the recording store. */
  transcribe(recordingId: string): Promise<string>;
};
