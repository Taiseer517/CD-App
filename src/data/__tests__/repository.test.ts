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
    expect(items.some((item) => item.title === 'Blackwater Park')).toBe(true)
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
    const shelf = await indexedDbRepository.createShelf({ name: 'Peaceville years', order: 0, accent: '', kind: 'music' })
    const item = await indexedDbRepository.create(draft({ shelfId: shelf.id, position: 2 }))

    await indexedDbRepository.removeShelf(shelf.id)

    const survivor = await indexedDbRepository.getById(item.id)
    expect(survivor).toBeDefined()
    expect(survivor?.shelfId).toBeNull()
  })

  it('saves a batch of placements in one pass', async () => {
    const items = await indexedDbRepository.getAll()
    const shelf = await indexedDbRepository.createShelf({ name: 'Doom', order: 0, accent: '', kind: 'music' })

    await indexedDbRepository.savePlacements(
      items.slice(0, 3).map((item, index) => ({ id: item.id, shelfId: shelf.id, position: index })),
    )

    const after = await indexedDbRepository.getAll()
    const placed = after.filter((item) => item.shelfId === shelf.id)
    expect(placed).toHaveLength(3)
    expect(placed.map((item) => item.position).sort()).toEqual([0, 1, 2])
  })

  it('brings a record saved before a field existed up to the current schema', async () => {
    await indexedDbRepository.getAll()

    // Exactly what an existing browser holds after the app gains a field: the
    // stored row predates it. Returned raw, the UI reads .length on undefined
    // and the whole page goes blank — which is what it did.
    const { writeOne } = await import('../idb')
    await writeOne('items', {
      id: 'legacy-row',
      type: 'cd',
      title: 'Saved Before The Update',
      year: 1994,
    })

    const found = await indexedDbRepository.getById('legacy-row')

    expect(found).toBeDefined()
    expect(found?.cast).toEqual([])
    expect(found?.synopsis).toBe('')
    expect(found?.sourceName).toBe('')
    expect(found?.trackList).toEqual([])
    expect(found?.shelfId).toBeNull()
  })

  it('skips a record too broken to repair rather than failing the whole read', async () => {
    const before = await indexedDbRepository.getAll()
    const { writeOne } = await import('../idb')
    // No title and no type: nothing the schema can default its way out of.
    await writeOne('items', { id: 'rubbish', nonsense: true })

    const items = await indexedDbRepository.getAll()

    expect(items.some((item) => item.id === 'rubbish')).toBe(false)
    // The rest of the collection still comes back.
    expect(items).toHaveLength(before.length)
  })

  it('brings a shelf saved before kind existed back onto the wall', async () => {
    await indexedDbRepository.getAll()

    // Exactly what an existing browser holds: a shelf written before the wall
    // learned to tell music from film. Returned raw it matched neither, so the
    // shelf vanished from the wall and took its records with it — filed to
    // something invisible, so not gathered into Unfiled either.
    const { writeOne } = await import('../idb')
    await writeOne('shelves', { id: 'legacy-shelf', name: 'Before The Split', order: 9 })

    const shelves = await indexedDbRepository.getShelves()
    const found = shelves.find((shelf) => shelf.id === 'legacy-shelf')

    expect(found).toBeDefined()
    expect(found?.kind).toBe('music')
  })

  it('skips a shelf too broken to repair rather than failing the whole read', async () => {
    const before = await indexedDbRepository.getShelves()
    const { writeOne } = await import('../idb')
    // No name: nothing the schema can default its way out of.
    await writeOne('shelves', { id: 'rubbish-shelf', order: 2 })

    const shelves = await indexedDbRepository.getShelves()

    expect(shelves.some((shelf) => shelf.id === 'rubbish-shelf')).toBe(false)
    expect(shelves).toHaveLength(before.length)
  })

  it('hangs the shelves in a new order without disturbing the rest', async () => {
    await indexedDbRepository.getAll()
    const [first, second] = await indexedDbRepository.getShelves()

    await indexedDbRepository.saveShelfOrder([
      { id: second.id, order: 0 },
      { id: first.id, order: 1 },
    ])

    const after = await indexedDbRepository.getShelves()
    expect(after[0].id).toBe(second.id)
    expect(after[1].id).toBe(first.id)
  })

  it('lays the curated collection out again on a deliberate reset', async () => {
    await indexedDbRepository.getAll()
    const seeded = await indexedDbRepository.getAll()
    for (const item of seeded) await indexedDbRepository.remove(item.id)
    expect(await indexedDbRepository.getAll()).toHaveLength(0)

    const restored = await indexedDbRepository.resetToStarter()

    expect(restored.items.length).toBeGreaterThan(0)
    expect(await indexedDbRepository.getAll()).toHaveLength(restored.items.length)
    // Every record lands on a shelf rather than in a heap.
    expect(restored.items.every((item) => item.shelfId !== null)).toBe(true)
  })

  it('replaces everything on import and reports it through snapshot', async () => {
    await indexedDbRepository.getAll()
    const replacement = {
      items: [{ ...emptyCollectionItemInput(), id: 'only-one', title: 'Floodland' }],
      shelves: [{ id: 'shelf-1', name: 'Merciful Release', order: 0, accent: '', kind: 'music' as const }],
    }

    await indexedDbRepository.replaceAll(replacement)
    const snapshot = await indexedDbRepository.snapshot()

    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0].title).toBe('Floodland')
    expect(snapshot.shelves).toHaveLength(1)
  })
})
