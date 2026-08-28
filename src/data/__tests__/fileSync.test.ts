import { describe, expect, it } from 'vitest'
import { buildArchive, parseArchive } from '../fileSync'
import { CollectionItemSchema, type CollectionItem } from '../schema'

function item(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return CollectionItemSchema.parse({
    id: 'a98c1d5d-263d-43e6-8926-7d06def614ba',
    type: 'cd',
    title: 'Bloody Kisses',
    year: 1993,
    ...overrides,
  })
}

describe('archive round-trip', () => {
  it('survives a full export and re-import unchanged', () => {
    const archive = buildArchive(
      [item({ genre: 'Gothic Metal', tags: ['romantic'] })],
      [{ id: 'shelf-1', name: 'Roadrunner', order: 0, accent: '' }],
    )

    const restored = parseArchive(JSON.stringify(archive))

    expect(restored.items).toEqual(archive.items)
    expect(restored.shelves).toEqual(archive.shelves)
  })

  it('accepts a bare array, so the old collection.json format still imports', () => {
    const restored = parseArchive(JSON.stringify([item()]))

    expect(restored.items).toHaveLength(1)
    expect(restored.items[0].title).toBe('Bloody Kisses')
    expect(restored.shelves).toEqual([])
  })

  it('backfills fields added since an older export was written', () => {
    // An export from before shelves existed: no shelfId, no trackList.
    const legacy = [
      { id: 'x', type: 'vinyl', title: 'Floodland', year: 1987 },
    ]

    const restored = parseArchive(JSON.stringify(legacy))

    expect(restored.items[0].shelfId).toBeNull()
    expect(restored.items[0].trackList).toEqual([])
    expect(restored.items[0].dominantColor).toBe('')
  })

  it('refuses a file that is not an archive rather than importing nothing', () => {
    expect(() => parseArchive('{"nonsense":true}')).toThrow()
    expect(() => parseArchive('[{"missing":"everything"}]')).toThrow()
  })

  it('refuses malformed JSON', () => {
    expect(() => parseArchive('not json at all')).toThrow()
  })
})
