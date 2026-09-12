import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'sarthak_offline';
const DB_VERSION = 1;
const STORE_PENDING_EVENTS = 'pending_events';
const STORE_PENDING_API = 'pending_api_calls';

interface PendingEvent {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface PendingApiCall {
  id: string;
  method: string;
  url: string;
  body: unknown;
  timestamp: number;
  retries: number;
}

let db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_PENDING_EVENTS)) {
        database.createObjectStore(STORE_PENDING_EVENTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_PENDING_API)) {
        database.createObjectStore(STORE_PENDING_API, { keyPath: 'id' });
      }
    },
  });

  return db;
}

/**
 * Queue an event for later sync when online.
 */
export async function queueOfflineEvent(
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const database = await getDB();
  const event: PendingEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    eventType,
    data,
    timestamp: Date.now(),
  };
  await database.put(STORE_PENDING_EVENTS, event);
  console.log(`[OFFLINE] Queued event: ${eventType}`);
}

/**
 * Queue an API call for retry when online.
 */
export async function queueApiCall(
  method: string,
  url: string,
  body: unknown
): Promise<void> {
  const database = await getDB();
  const call: PendingApiCall = {
    id: `api_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    method,
    url,
    body,
    timestamp: Date.now(),
    retries: 0,
  };
  await database.put(STORE_PENDING_API, call);
  console.log(`[OFFLINE] Queued API call: ${method} ${url}`);
}

/**
 * Flush all pending API calls when back online.
 */
export async function flushPendingCalls(): Promise<void> {
  const database = await getDB();
  const calls = await database.getAll(STORE_PENDING_API);

  for (const call of calls) {
    try {
      await fetch(call.url, {
        method: call.method,
        headers: { 'Content-Type': 'application/json' },
        body: call.body ? JSON.stringify(call.body) : undefined,
        credentials: 'include',
      });

      // Success — remove from queue
      await database.delete(STORE_PENDING_API, call.id);
      console.log(`[OFFLINE] Flushed: ${call.method} ${call.url}`);
    } catch {
      // Increment retry count
      call.retries++;
      if (call.retries > 5) {
        await database.delete(STORE_PENDING_API, call.id);
        console.warn(`[OFFLINE] Dropped after 5 retries: ${call.url}`);
      } else {
        await database.put(STORE_PENDING_API, call);
      }
    }
  }
}

/**
 * Auto-flush when coming back online.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OFFLINE] Back online — flushing pending calls');
    flushPendingCalls();
  });
}
