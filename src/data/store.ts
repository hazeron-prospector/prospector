/**
 * IndexedDB cache of the last parsed StarMap (never the raw XML).
 * A single record under key 'last'. Entries whose schemaVersion differs from
 * SCHEMA_VERSION are discarded on load.
 */
import { SCHEMA_VERSION, type StarMap } from './types'

export const DB_NAME = 'prospector'
const DB_VERSION = 1
const STORE = 'maps'
const KEY = 'last'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'))
    // onblocked is transient: the request stays pending and onsuccess/onerror still fires.
  })
}

/** Runs one transaction and resolves once it has committed. */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  } finally {
    db.close()
  }
}

export async function saveMap(map: StarMap): Promise<void> {
  await withStore('readwrite', (s) => s.put(map, KEY))
}

function isStarMap(v: unknown): v is StarMap {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  return (
    m.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(m.systems) &&
    Array.isArray(m.sectors) &&
    typeof m.empire === 'string' &&
    typeof m.createDate === 'string'
  )
}

/** Returns the cached map, or undefined when empty, malformed or from another schema version. */
export async function loadMap(): Promise<StarMap | undefined> {
  const value: unknown = await withStore('readonly', (s) => s.get(KEY))
  if (isStarMap(value)) return value
  if (value !== undefined) await clearMap()
  return undefined
}

export async function clearMap(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(KEY))
}
