// The phone's own copy of each recording, in IndexedDB, until the server has it. If the upload
// fails (no signal, the app closed), the audio is still here to send on Retry.
const DB = 'cuisine-dictation';
const STORE = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export type LocalAudio = { blob: Blob; filename: string };

export const localAudio = {
  put: (id: string, audio: LocalAudio) => run('readwrite', s => s.put(audio, id)).then(() => undefined),
  get: (id: string) => run<LocalAudio | undefined>('readonly', s => s.get(id)).then(a => a ?? null),
  remove: (id: string) => run('readwrite', s => s.delete(id)).then(() => undefined).catch(() => undefined),
};
