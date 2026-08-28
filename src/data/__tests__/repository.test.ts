import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { resetConnection } from '../idb'
import { indexedDbRepository } from '../repository/indexedDbRepository'
import { emptyCollectionItemInput } from '../schema'

// Each test starts from a blank database. Reaching for a fresh IDBFactory is
// the only reliable reset — deleting the database leaves the cached open
// promise in idb.ts pointing at a closed connection.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetConnection()
})

function draft(overrides: Partial<ReturnType<typeof emptyCollectionItemInput>> = {}) {
  return { ...emptyCollectionItemInput(), title: 'Turn Loose the Swans', ...overrides }
}

describe('indexedDbRepository', () => {
  it('seeds the starter collection on first read', async () => {
    const items = await indexedDbRepository.getAll()
    expect(items.length).toBeGreaterThan(0)
    expect(items.some((item) => item.title === 'Bloody Kisses')).toBe(true)
  })

  it('does not re-seed after the collection is emptied', async () => {
    const seeded = await indexedDbRepository.getAll()
    for (const item of seeded) await indexedDbRepository.remove(item.id)

    const afterDeleting = await indexedDbRepository.getAll()
    expect(afterDeleting).toHaveLength(0)
  })

  it('persists a created item across a fresh read', async () => {
    await indexedDbRepository.getAll()
    const created = await indexedDbRepository.create(draft({ title: 'The Angel and the Dark River' }))

    const found = await indexedDbRepository.getById(created.id)
    expect(found?.title).toBe('The Angel and the Dark River')
  })

  it('applies schema defaults to the new placement fields', async () => {
    await indexedDbRepository.getAll()
    const created = await indexedDbRepository.create(draft())

    expect(created.shelfId).toBeNull()
    expect(created.position).toBe(0)
    expect(created.trackList).toEqual([])
  })

  it('updates an item without dropping unspecified fields', async () => {
    await indexedDbRepository.getAll()
    const created = await indexedDbRepository.create(draft({ genre: 'Doom/Death Metal', rating: 4 }))

    const updated = await indexedDbRepository.update(created.id, { rating: 5 })
    expect(updated.rating).toBe(5)
    expect(updated.genre).toBe('Doom/Death Metal')
  })

  it('rejects an update to an item that does not exist', async () => {
    await expect(indexedDbRepository.update('missing-id', { rating: 3 })).rejects.toThrow(
      /not found/i,
    )
  })

  it('keeps items when their shelf is deleted, returning them to unfiled', async () => {
    await indexedDbRepository.getAll()
    const shelf = await indexedDbRepository.createShelf({ name: 'Peaceville years', order: 0, accent: '' })
    const item = await indexedDbRepository.create(draft({ shelfId: shelf.id, position: 2 }))

    await indexedDbRepository.removeShelf(shelf.id)

    const survivor = await indexedDbRepository.getById(item.id)
    expect(survivor).toBeDefined()
    expect(survivor?.shelfId).toBeNull()
  })

  it('saves a batch of placements in one pass', async () => {
    const items = await indexedDbRepository.getAll()
    const shelf = await indexedDbRepository.createShelf({ name: 'Doom', order: 0, accent: '' })

    await indexedDbRepository.savePlacements(
      items.slice(0, 3).map((item, index) => ({ id: item.id, shelfId: shelf.id, position: index })),
    )

    const after = await indexedDbRepository.getAll()
    const placed = after.filter((item) => item.shelfId === shelf.id)
    expect(placed).toHaveLength(3)
    expect(placed.map((item) => item.position).sort()).toEqual([0, 1, 2])
  })

  it('replaces everything on import and reports it through snapshot', async () => {
    await indexedDbRepository.getAll()
    const replacement = {
      items: [{ ...emptyCollectionItemInput(), id: 'only-one', title: 'Floodland' }],
      shelves: [{ id: 'shelf-1', name: 'Merciful Release', order: 0, accent: '' }],
    }

    await indexedDbRepository.replaceAll(replacement)
    const snapshot = await indexedDbRepository.snapshot()

    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0].title).toBe('Floodland')
    expect(snapshot.shelves).toHaveLength(1)
  })
})
