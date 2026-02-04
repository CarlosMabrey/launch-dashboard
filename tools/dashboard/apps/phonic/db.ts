
import { MusicDemo } from './types';

const DB_NAME = 'PhonicVault';
const STORE_NAME = 'demos';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveDemos(demos: MusicDemo[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear and put all demos to keep sync with UI state
    // In a larger app we might use fine-grained updates, but for this vault 
    // replacing the set is simpler and matches the previous localStorage logic.
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      let completed = 0;
      if (demos.length === 0) {
        resolve();
        return;
      }

      demos.forEach(demo => {
        const request = store.put(demo);
        request.onsuccess = () => {
          completed++;
          if (completed === demos.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    };

    clearRequest.onerror = () => reject(clearRequest.error);
  });
}

export async function loadDemosFromDB(): Promise<MusicDemo[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
