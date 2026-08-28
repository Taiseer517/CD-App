import rawCollection from '../collection.json'
import {
  readAll,
  readMeta,
  replaceStore,
  writeMeta,
  writeOne,
  deleteOne,
  STORE_ITEMS,
  STORE_SHELVES,
} from '../idb'
import {
  CollectionItemSchema,
  ShelfSchema,
  type CollectionItem,
  type Shelf,
} from '../schema'
import type { CollectionRepository, CollectionSnapshot } from './types'

const SEEDED_KEY = 'seeded'

function newId(): string {
  // randomUUID needs a secure context; localhost qualifies, but a LAN address
  // over plain http does not, and that is a normal way to test on a phone.
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseItems(raw: unknown[]): CollectionItem[] {
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

/**
 * A starting arrangement by medium. Everything can be renamed, reordered or
 * torn down afterwards — this exists so the first view is a bookcase with
 * rows rather than one long crowded shelf.
 */
const STARTER_SHELVES: { name: string; type: CollectionItem['type'] }[] = [
  { name: 'Compact Discs', type: 'cd' },
  { name: 'Records', type: 'vinyl' },
  { name: 'Films', type: 'dvd' },
]

/**
 * Seeds the starter collection on first run only. The marker matters: without
 * it, emptying the collection deliberately would silently refill it on the
 * next reload.
 */
async function ensureSeeded(): Promise<void> {
  if (await readMeta<boolean>(SEEDED_KEY)) return

  const existing = await readAll<CollectionItem>(STORE_ITEMS)
  if (existing.length === 0) {
    const items = parseItems(rawCollection as unknown[])

    const shelves: Shelf[] = STARTER_SHELVES.map((definition, order) =>
      ShelfSchema.parse({ id: newId(), name: definition.name, order, accent: '' }),
    )
    const shelfByType = new Map(STARTER_SHELVES.map((d, index) => [d.type, shelves[index].id]))

    const counters = new Map<string, number>()
    const placed = items.map((item) => {
      const shelfId = shelfByType.get(item.type) ?? null
      const key = shelfId ?? 'unfiled'
      const position = counters.get(key) ?? 0
      counters.set(key, position + 1)
      return { ...item, shelfId, position }
    })

    await replaceStore(STORE_SHELVES, shelves)
    await replaceStore(STORE_ITEMS, placed)
  }

  await writeMeta(SEEDED_KEY, true)
}

/**
 * Reads the store and brings every record up to the current schema.
 *
 * Records written before a field existed come back without it, and the app
 * then reads `item.cast.length` on undefined and white-screens. Parsing on the
 * way out lets the schema's defaults fill the gaps, which is what they are
 * for — and means adding a field never strands the data already saved.
 */
async function readItems(): Promise<CollectionItem[]> {
  const stored = await readAll<unknown>(STORE_ITEMS)
  const items: CollectionItem[] = []
  for (const entry of stored) {
    const parsed = CollectionItemSchema.safeParse(entry)
    if (parsed.success) items.push(parsed.data)
    else console.warn('Skipping a record that no longer fits the schema', entry, parsed.error.flatten())
  }
  return items
}

async function requireItem(id: string): Promise<{ items: CollectionItem[]; item: CollectionItem }> {
  const items = await readItems()
  const item = items.find((entry) => entry.id === id)
  if (!item) throw new Error(`Collection item not found: ${id}`)
  return { items, item }
}

export const indexedDbRepository: CollectionRepository = {
  async getAll() {
    await ensureSeeded()
    return readItems()
  },

  async getById(id) {
    await ensureSeeded()
    const items = await readItems()
    return items.find((item) => item.id === id)
  },

  async create(input) {
    const item = CollectionItemSchema.parse({ ...input, id: newId() })
    await writeOne(STORE_ITEMS, item)
    return item
  },

  async update(id, patch) {
    const { item } = await requireItem(id)
    const updated = CollectionItemSchema.parse({ ...item, ...patch, id })
    await writeOne(STORE_ITEMS, updated)
    return updated
  },

  async remove(id) {
    await deleteOne(STORE_ITEMS, id)
  },

  async getShelves() {
    const shelves = await readAll<Shelf>(STORE_SHELVES)
    return shelves.sort((a, b) => a.order - b.order)
  },

  async createShelf(input) {
    const shelf = ShelfSchema.parse({ ...input, id: newId() })
    await writeOne(STORE_SHELVES, shelf)
    return shelf
  },

  async updateShelf(id, patch) {
    const shelves = await readAll<Shelf>(STORE_SHELVES)
    const existing = shelves.find((shelf) => shelf.id === id)
    if (!existing) throw new Error(`Shelf not found: ${id}`)
    const updated = ShelfSchema.parse({ ...existing, ...patch, id })
    await writeOne(STORE_SHELVES, updated)
    return updated
  },

  async removeShelf(id) {
    await deleteOne(STORE_SHELVES, id)
    // Items keep existing; they fall back to Unfiled rather than vanishing
    // along with the shelf they happened to be sitting on.
    const items = await readItems()
    const orphans = items.filter((item) => item.shelfId === id)
    if (orphans.length > 0) {
      await replaceStore(
        STORE_ITEMS,
        items.map((item) => (item.shelfId === id ? { ...item, shelfId: null } : item)),
      )
    }
  },

  async savePlacements(placements) {
    if (placements.length === 0) return
    const items = await readItems()
    const byId = new Map(placements.map((placement) => [placement.id, placement]))
    await replaceStore(
      STORE_ITEMS,
      items.map((item) => {
        const placement = byId.get(item.id)
        return placement ? { ...item, shelfId: placement.shelfId, position: placement.position } : item
      }),
    )
  },

  async replaceAll(snapshot) {
    await replaceStore(STORE_ITEMS, snapshot.items)
    await replaceStore(STORE_SHELVES, snapshot.shelves)
    await writeMeta(SEEDED_KEY, true)
  },

  async snapshot(): Promise<CollectionSnapshot> {
    const [items, shelves] = await Promise.all([readItems(), readAll<Shelf>(STORE_SHELVES)])
    return { items, shelves: shelves.sort((a, b) => a.order - b.order) }
  },
}
