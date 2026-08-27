import rawCollection from '../collection.json'
import { CollectionItemSchema, type CollectionItem } from '../schema'
import type { CollectionRepository } from './types'

function parseSeedData(raw: unknown[]): CollectionItem[] {
  const items: CollectionItem[] = []
  for (const entry of raw) {
    const result = CollectionItemSchema.safeParse(entry)
    if (result.success) {
      items.push(result.data)
    } else {
      console.warn('Skipping invalid collection item', entry, result.error.flatten())
    }
  }
  return items
}

let cache: CollectionItem[] | null = null

function loadCache(): CollectionItem[] {
  if (!cache) {
    cache = parseSeedData(rawCollection as unknown[])
  }
  return cache
}

async function persist(items: CollectionItem[]): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    await fetch('/api/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items, null, 2),
    })
  } catch (err) {
    console.error('Failed to persist collection to disk via the dev write endpoint', err)
  }
}

export const localRepository: CollectionRepository = {
  async getAll() {
    return [...loadCache()]
  },

  async getById(id) {
    return loadCache().find((item) => item.id === id)
  },

  async create(input) {
    const item: CollectionItem = CollectionItemSchema.parse({ ...input, id: crypto.randomUUID() })
    const items = loadCache()
    items.push(item)
    await persist(items)
    return item
  },

  async update(id, patch) {
    const items = loadCache()
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) throw new Error(`Collection item not found: ${id}`)
    const updated = CollectionItemSchema.parse({ ...items[index], ...patch, id })
    items[index] = updated
    await persist(items)
    return updated
  },

  async remove(id) {
    const items = loadCache()
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) return
    items.splice(index, 1)
    await persist(items)
  },
}
