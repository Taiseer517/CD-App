import { create } from 'zustand'
import { getRepository } from '../data/repository'
import {
  buildArchive,
  chooseArchiveFile,
  downloadArchive,
  forgetArchiveFile,
  isFileSyncSupported,
  parseArchive,
  reconnectArchiveFile,
  restoreArchiveFile,
  writeArchiveFile,
} from '../data/fileSync'
import type { CollectionItem, CollectionItemInput, Shelf, ShelfInput } from '../data/schema'

export type SyncState = 'unsupported' | 'off' | 'connected' | 'saving' | 'stale' | 'error'

interface CollectionState {
  items: CollectionItem[]
  shelves: Shelf[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null

  fileHandle: FileSystemFileHandle | null
  syncState: SyncState
  syncError: string | null
  lastSavedAt: string | null

  fetchAll: () => Promise<void>
  addItem: (input: CollectionItemInput) => Promise<CollectionItem>
  updateItem: (id: string, patch: Partial<CollectionItemInput>) => Promise<CollectionItem>
  deleteItem: (id: string) => Promise<void>

  addShelf: (input: ShelfInput) => Promise<Shelf>
  renameShelf: (id: string, name: string) => Promise<void>
  deleteShelf: (id: string) => Promise<void>
  savePlacements: (placements: { id: string; shelfId: string | null; position: number }[]) => Promise<void>

  connectFile: () => Promise<void>
  reconnectFile: () => Promise<void>
  disconnectFile: () => Promise<void>
  exportArchive: () => void
  importArchive: (file: File) => Promise<number>
}

const AUTOSAVE_DELAY_MS = 800
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

export const useCollectionStore = create<CollectionState>((set, get) => {
  /**
   * Mirrors the collection out to the linked file. Debounced because a drag
   * across a shelf produces a burst of placement writes, and each one would
   * otherwise open a writable stream of its own.
   */
  function scheduleSync() {
    if (!get().fileHandle) return
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      void flushSync()
    }, AUTOSAVE_DELAY_MS)
  }

  async function flushSync() {
    const { fileHandle, items, shelves } = get()
    if (!fileHandle) return
    set({ syncState: 'saving', syncError: null })
    try {
      await writeArchiveFile(fileHandle, buildArchive(items, shelves))
      set({ syncState: 'connected', lastSavedAt: new Date().toISOString() })
    } catch (err) {
      // Almost always a lapsed permission after a browser restart. The copy in
      // IndexedDB is still correct, so this degrades rather than loses data.
      set({
        syncState: 'stale',
        syncError: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    items: [],
    shelves: [],
    status: 'idle',
    error: null,

    fileHandle: null,
    syncState: isFileSyncSupported() ? 'off' : 'unsupported',
    syncError: null,
    lastSavedAt: null,

    async fetchAll() {
      set({ status: 'loading', error: null })
      try {
        const { items, shelves } = await getRepository().snapshot()
        // snapshot() does not seed; getAll() does. Call it so a first run has
        // something on the shelf instead of an empty room.
        const seeded = items.length === 0 ? await getRepository().getAll() : items
        set({ items: seeded, shelves, status: 'ready' })

        if (isFileSyncSupported()) {
          const handle = await restoreArchiveFile()
          if (handle) set({ fileHandle: handle, syncState: 'connected' })
        }
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      }
    },

    async addItem(input) {
      const created = await getRepository().create(input)
      set((state) => ({ items: [...state.items, created] }))
      scheduleSync()
      return created
    },

    async updateItem(id, patch) {
      const updated = await getRepository().update(id, patch)
      set((state) => ({ items: state.items.map((item) => (item.id === id ? updated : item)) }))
      scheduleSync()
      return updated
    },

    async deleteItem(id) {
      await getRepository().remove(id)
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
      scheduleSync()
    },

    async addShelf(input) {
      const shelf = await getRepository().createShelf(input)
      set((state) => ({ shelves: [...state.shelves, shelf].sort((a, b) => a.order - b.order) }))
      scheduleSync()
      return shelf
    },

    async renameShelf(id, name) {
      const updated = await getRepository().updateShelf(id, { name })
      set((state) => ({ shelves: state.shelves.map((shelf) => (shelf.id === id ? updated : shelf)) }))
      scheduleSync()
    },

    async deleteShelf(id) {
      await getRepository().removeShelf(id)
      set((state) => ({
        shelves: state.shelves.filter((shelf) => shelf.id !== id),
        items: state.items.map((item) => (item.shelfId === id ? { ...item, shelfId: null } : item)),
      }))
      scheduleSync()
    },

    async savePlacements(placements) {
      if (placements.length === 0) return
      await getRepository().savePlacements(placements)
      const byId = new Map(placements.map((placement) => [placement.id, placement]))
      set((state) => ({
        items: state.items.map((item) => {
          const placement = byId.get(item.id)
          return placement
            ? { ...item, shelfId: placement.shelfId, position: placement.position }
            : item
        }),
      }))
      scheduleSync()
    },

    async connectFile() {
      const handle = await chooseArchiveFile()
      if (!handle) return
      set({ fileHandle: handle, syncState: 'connected', syncError: null })
      await flushSync()
    },

    async reconnectFile() {
      const handle = await reconnectArchiveFile()
      if (!handle) {
        set({ syncState: 'stale', syncError: 'Permission was not granted.' })
        return
      }
      set({ fileHandle: handle, syncState: 'connected', syncError: null })
      await flushSync()
    },

    async disconnectFile() {
      await forgetArchiveFile()
      set({ fileHandle: null, syncState: 'off', syncError: null, lastSavedAt: null })
    },

    exportArchive() {
      const { items, shelves } = get()
      downloadArchive(buildArchive(items, shelves))
    },

    async importArchive(file) {
      const archive = parseArchive(await file.text())
      await getRepository().replaceAll({ items: archive.items, shelves: archive.shelves })
      set({ items: archive.items, shelves: archive.shelves })
      scheduleSync()
      return archive.items.length
    },
  }
})
