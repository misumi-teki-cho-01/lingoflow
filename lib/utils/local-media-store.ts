const DB_NAME = 'lingoflow-local-media';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';

export interface LocalVideoRecord {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  duration?: number;
  createdAt: string;
}

function openLocalMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open local media DB'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openLocalMediaDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, mode);
    const request = run(tx.objectStore(VIDEO_STORE));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local media DB request failed'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Local media DB transaction failed'));
    };
  });
}

export function createLocalVideoId(): string {
  return `local-${crypto.randomUUID()}`;
}

export async function saveLocalVideo(record: LocalVideoRecord): Promise<void> {
  await withStore('readwrite', (store) => store.put(record));
}

export async function getLocalVideo(videoId: string): Promise<LocalVideoRecord | null> {
  return (await withStore('readonly', (store) => store.get(videoId))) ?? null;
}

export async function deleteLocalVideo(videoId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(videoId));
}
