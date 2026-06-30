// Client-side local IndexedDB manager queuing user actions (dose logs and hydration updates) when offline.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface QueuedAction {
  id: string;
  type: 'LOG_DOSE' | 'HYDRATION';
  payload: Record<string, unknown>;
  queuedAt: string; 
  url: string;
}

interface MedMindDB extends DBSchema {
  offline_queue: {
    key: string;
    value: QueuedAction;
  };
}

let dbPromise: Promise<IDBPDatabase<MedMindDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MedMindDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MedMindDB>('medmind-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.createObjectStore('offline_queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueAction(action: Omit<QueuedAction, 'id' | 'queuedAt'>): Promise<QueuedAction> {
  const db = await getDB();
  // Construct a unique transaction ID combining current milliseconds with a base-36 random sequence.
  const entry: QueuedAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: new Date().toISOString(),
  };
  // Store the queued event in IndexedDB for replay when network restores.
  await db.put('offline_queue', entry);
  return entry;
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await getDB();
  return db.getAll('offline_queue');
}

export async function clearQueuedAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline_queue', id);
}

export async function clearAllQueuedActions(): Promise<void> {
  const db = await getDB();
  await db.clear('offline_queue');
}
