/**
 * A minimal promise wrapper over IndexedDB.
 *
 * Hand-rolled rather than pulling in a library because the access pattern here
 * is small and fixed: three stores, whole-store reads, single-record writes.
 * Everything returns a promise so callers never touch the event API.
 */

const DB_NAME = 'the-archive'
const DB_VERSION = 1

export const STORE_ITEMS = 'items'
export const STORE_SHELVES = 'shelves'
export const STORE_META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    // Firefox throws rather than returning null when storage is fully blocked.
    return false
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_SHELVES)) {
        db.createObjectStore(STORE_SHELVES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open tab'))
  })

  // A failed open must not be cached, or every later call inherits the failure.
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

/**
 * Drops the memoised connection so the next call re-opens.
 * Used by the tests, which swap in a fresh in-memory IndexedDB per case and
 * would otherwise keep talking to the previous one through this cache.
 */
export function resetConnection(): void {
  dbPromise = null
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/** Resolves once the transaction actually commits, not merely when the request returns. */
function commit(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function readAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  const tx = db.transaction(store, 'readonly')
  const result = await promisify<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>)
  return result
}

export async function writeOne(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value, key)
  await commit(tx)
}

export async function deleteOne(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(key)
  await commit(tx)
}

/** Replaces a store's entire contents in one transaction, so a failure rolls back. */
export async function replaceStore(store: string, values: unknown[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  const objectStore = tx.objectStore(store)
  objectStore.clear()
  for (const value of values) objectStore.put(value)
  await commit(tx)
}

export async function readMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  const tx = db.transaction(STORE_META, 'readonly')
  return promisify<T | undefined>(tx.objectStore(STORE_META).get(key) as IDBRequest<T | undefined>)
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await writeOne(STORE_META, value, key)
}

export async function deleteMeta(key: string): Promise<void> {
  await deleteOne(STORE_META, key)
}
