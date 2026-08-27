import { create } from 'zustand'
import { getRepository } from '../data/repository'
import type { CollectionItem, CollectionItemInput } from '../data/schema'

interface CollectionState {
  items: CollectionItem[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  fetchAll: () => Promise<void>
  addItem: (input: CollectionItemInput) => Promise<CollectionItem>
  updateItem: (id: string, patch: Partial<CollectionItemInput>) => Promise<CollectionItem>
  deleteItem: (id: string) => Promise<void>
}

export const useCollectionStore = create<CollectionState>((set) => ({
  items: [],
  status: 'idle',
  error: null,

  async fetchAll() {
    set({ status: 'loading', error: null })
    try {
      const items = await getRepository().getAll()
      set({ items, status: 'ready' })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },

  async addItem(input) {
    const created = await getRepository().create(input)
    set((state) => ({ items: [...state.items, created] }))
    return created
  },

  async updateItem(id, patch) {
    const updated = await getRepository().update(id, patch)
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? updated : item)),
    }))
    return updated
  },

  async deleteItem(id) {
    await getRepository().remove(id)
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },
}))
