import { describe, expect, it } from 'vitest'
import { findDuplicate } from '../duplicates'
import { CollectionItemSchema, type CollectionItem } from '../schema'

let counter = 0
function owned(overrides: Partial<CollectionItem> = {}): CollectionItem {
  counter += 1
  return CollectionItemSchema.parse({
    id: `owned-${counter}`,
    type: 'cd',
    title: 'Bloody Kisses',
    artistOrDirector: 'Type O Negative',
    year: 1993,
    ...overrides,
  })
}

describe('findDuplicate', () => {
  it('finds nothing in an empty collection', () => {
    expect(findDuplicate({ title: 'Aion', artistOrDirector: 'Dead Can Dance' }, [])).toBeNull()
  })

  it('treats a matching barcode as certain', () => {
    const collection = [owned({ barcode: '016861910020' })]
    const match = findDuplicate({ title: 'Anything', barcode: '016861910020' }, collection)

    expect(match?.confidence).toBe('exact')
    expect(match?.reason).toContain('barcode')
  })

  it('treats the same pressing id as certain', () => {
    const collection = [owned({ musicbrainzId: 'abc-123' })]
    const match = findDuplicate({ title: 'x', musicbrainzId: 'abc-123' }, collection)

    expect(match?.confidence).toBe('exact')
  })

  it('treats a title and artist match as likely, not certain', () => {
    // Two pressings of one album is a real thing to own, so this warns
    // rather than refuses.
    const collection = [owned({ barcode: '111' })]
    const match = findDuplicate(
      { title: 'Bloody Kisses', artistOrDirector: 'Type O Negative', barcode: '999' },
      collection,
    )

    expect(match?.confidence).toBe('likely')
  })

  it('ignores punctuation and case when comparing titles', () => {
    const collection = [owned({ title: "Bram Stoker's Dracula", artistOrDirector: 'Coppola' })]
    const match = findDuplicate(
      { title: 'BRAM STOKERS DRACULA', artistOrDirector: 'coppola' },
      collection,
    )

    expect(match).not.toBeNull()
  })

  it('does not confuse two albums that merely share a title', () => {
    const collection = [owned({ title: 'Nosferatu', artistOrDirector: 'Helstar' })]
    const match = findDuplicate(
      { title: 'Nosferatu', artistOrDirector: 'Bloodbound' },
      collection,
    )

    expect(match).toBeNull()
  })
})
