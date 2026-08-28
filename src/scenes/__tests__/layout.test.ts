import { describe, expect, it } from 'vitest'
import { CollectionItemSchema, type CollectionItem, type Shelf } from '../../data/schema'
import { CASE_DIMENSIONS, MAX_BOOKCASE_WIDTH } from '../dimensions'
import { layoutBookcase, reindexAfterMove, slotIndexAt, UNFILED_NAME } from '../layout'

let counter = 0
function make(overrides: Partial<CollectionItem> = {}): CollectionItem {
  counter += 1
  return CollectionItemSchema.parse({
    id: `item-${counter}`,
    type: 'cd',
    title: `Record ${counter}`,
    year: 1993,
    ...overrides,
  })
}

const shelf = (id: string, name: string, order: number): Shelf => ({ id, name, order, accent: '' })

describe('layoutBookcase', () => {
  it('puts unfiled items in their own row when there are no shelves', () => {
    const layout = layoutBookcase([make(), make()], [])

    expect(layout.rows).toHaveLength(1)
    expect(layout.rows[0].name).toBe(UNFILED_NAME)
    expect(layout.rows[0].cases).toHaveLength(2)
  })

  it('keeps a named shelf visible while empty so there is somewhere to drop', () => {
    const layout = layoutBookcase([], [shelf('s1', 'Doom', 0)])

    expect(layout.rows).toHaveLength(1)
    expect(layout.rows[0].name).toBe('Doom')
    expect(layout.rows[0].cases).toEqual([])
  })

  it('drops the unfiled row once everything has been put away', () => {
    const layout = layoutBookcase([make({ shelfId: 's1' })], [shelf('s1', 'Doom', 0)])

    expect(layout.rows.map((row) => row.name)).toEqual(['Doom'])
  })

  it('orders rows by the shelf order, with unfiled last', () => {
    const layout = layoutBookcase(
      [make(), make({ shelfId: 'b' }), make({ shelfId: 'a' })],
      [shelf('b', 'Second', 2), shelf('a', 'First', 1)],
    )

    expect(layout.rows.map((row) => row.name)).toEqual(['First', 'Second', UNFILED_NAME])
  })

  it('sorts a shelf by position, falling back to title when positions tie', () => {
    const layout = layoutBookcase(
      [
        make({ shelfId: 's1', position: 0, title: 'Zoetrope' }),
        make({ shelfId: 's1', position: 0, title: 'Aurora' }),
        make({ shelfId: 's1', position: 1, title: 'Middle' }),
      ],
      [shelf('s1', 'Doom', 0)],
    )

    expect(layout.rows[0].cases.map((entry) => entry.item.title)).toEqual([
      'Aurora',
      'Zoetrope',
      'Middle',
    ])
  })

  it('gives a row holding vinyl the headroom a 12 inch record needs', () => {
    const cdOnly = layoutBookcase([make({ shelfId: 's1' })], [shelf('s1', 'CDs', 0)])
    const withVinyl = layoutBookcase(
      [make({ shelfId: 's1', type: 'vinyl' })],
      [shelf('s1', 'LPs', 0)],
    )

    expect(withVinyl.rows[0].height).toBeGreaterThan(cdOnly.rows[0].height)
    expect(withVinyl.rows[0].height).toBeGreaterThan(CASE_DIMENSIONS.vinyl.height)
  })

  it('rests every case on its plank rather than floating mid-row', () => {
    const layout = layoutBookcase(
      [make({ shelfId: 's1', type: 'cd' }), make({ shelfId: 's1', type: 'vinyl' })],
      [shelf('s1', 'Mixed', 0)],
    )

    for (const placed of layout.rows[0].cases) {
      const bottom = placed.y - CASE_DIMENSIONS[placed.item.type].height / 2
      // Every case bottom sits at the same height: the surface of the plank.
      expect(bottom).toBeCloseTo(layout.rows[0].plankY + 0.04 + 0.14, 1)
    }
  })

  it('compresses a packed row instead of growing wider than the bookcase', () => {
    const many = Array.from({ length: 40 }, () => make({ shelfId: 's1' }))
    const layout = layoutBookcase(many, [shelf('s1', 'Packed', 0)])
    const row = layout.rows[0]

    const span = (row.cases.length - 1) * row.pitch
    expect(span).toBeLessThanOrEqual(MAX_BOOKCASE_WIDTH)
    expect(row.pitch).toBeLessThan(CASE_DIMENSIONS.cd.width)
  })

  it('sizes the bookcase to its contents rather than a fixed width', () => {
    const small = layoutBookcase([make({ shelfId: 's1' })], [shelf('s1', 'Few', 0)])
    const large = layoutBookcase(
      Array.from({ length: 12 }, () => make({ shelfId: 's1' })),
      [shelf('s1', 'Many', 0)],
    )

    expect(small.width).toBeLessThan(large.width)
    expect(large.width).toBeLessThanOrEqual(MAX_BOOKCASE_WIDTH)
  })

  it('never lets a row overflow the case it is drawn inside', () => {
    for (const count of [1, 3, 9, 25, 60]) {
      const layout = layoutBookcase(
        Array.from({ length: count }, () => make({ shelfId: 's1' })),
        [shelf('s1', 'Row', 0)],
      )
      const row = layout.rows[0]
      const span = (row.cases.length - 1) * row.pitch + CASE_DIMENSIONS.cd.width
      expect(span).toBeLessThanOrEqual(layout.width + 0.01)
    }
  })

  it('leaves wishlist items off the shelf entirely', () => {
    const layout = layoutBookcase([make(), make({ wishlist: true })], [])

    expect(layout.rows[0].cases).toHaveLength(1)
  })

  it('treats an item pointing at a deleted shelf as unfiled', () => {
    const layout = layoutBookcase([make({ shelfId: 'gone' })], [shelf('s1', 'Doom', 0)])

    const unfiled = layout.rows.find((row) => row.shelfId === null)
    expect(unfiled?.cases).toHaveLength(1)
  })
})

describe('slotIndexAt', () => {
  it('reads a drop past the right edge as the end of the row', () => {
    const layout = layoutBookcase(
      [make({ shelfId: 's1' }), make({ shelfId: 's1' }), make({ shelfId: 's1' })],
      [shelf('s1', 'Doom', 0)],
    )
    expect(slotIndexAt(layout.rows[0], 99)).toBe(3)
  })

  it('reads a drop past the left edge as the start of the row', () => {
    const layout = layoutBookcase(
      [make({ shelfId: 's1' }), make({ shelfId: 's1' })],
      [shelf('s1', 'Doom', 0)],
    )
    expect(slotIndexAt(layout.rows[0], -99)).toBe(0)
  })

  it('returns the first slot for an empty row', () => {
    const layout = layoutBookcase([], [shelf('s1', 'Doom', 0)])
    expect(slotIndexAt(layout.rows[0], 0)).toBe(0)
  })
})

describe('reindexAfterMove', () => {
  it('renumbers a row when a case is dragged to its front', () => {
    const items = [
      make({ id: 'a', shelfId: 's1', position: 0 }),
      make({ id: 'b', shelfId: 's1', position: 1 }),
      make({ id: 'c', shelfId: 's1', position: 2 }),
    ]
    const layout = layoutBookcase(items, [shelf('s1', 'Doom', 0)])

    const changes = reindexAfterMove(layout, 'c', 's1', 0)
    const byId = new Map(changes.map((change) => [change.id, change.position]))

    expect(byId.get('c')).toBe(0)
    expect(byId.get('a')).toBe(1)
    expect(byId.get('b')).toBe(2)
  })

  it('closes the gap in the row a case was dragged out of', () => {
    const items = [
      make({ id: 'a', shelfId: 's1', position: 0 }),
      make({ id: 'b', shelfId: 's1', position: 1 }),
      make({ id: 'c', shelfId: 's2', position: 0 }),
    ]
    const layout = layoutBookcase(items, [shelf('s1', 'One', 0), shelf('s2', 'Two', 1)])

    const changes = reindexAfterMove(layout, 'a', 's2', 0)
    const byId = new Map(changes.map((change) => [change.id, change]))

    expect(byId.get('a')).toMatchObject({ shelfId: 's2', position: 0 })
    expect(byId.get('c')).toMatchObject({ shelfId: 's2', position: 1 })
    // b was second on shelf one and should slide down to first.
    expect(byId.get('b')).toMatchObject({ shelfId: 's1', position: 0 })
  })

  it('reports nothing when a case is dropped back where it started', () => {
    const items = [
      make({ id: 'a', shelfId: 's1', position: 0 }),
      make({ id: 'b', shelfId: 's1', position: 1 }),
    ]
    const layout = layoutBookcase(items, [shelf('s1', 'Doom', 0)])

    expect(reindexAfterMove(layout, 'a', 's1', 0)).toEqual([])
  })

  it('moves an item onto the unfiled row', () => {
    const items = [make({ id: 'a', shelfId: 's1', position: 0 }), make({ id: 'b' })]
    const layout = layoutBookcase(items, [shelf('s1', 'Doom', 0)])

    const changes = reindexAfterMove(layout, 'a', null, 0)
    expect(changes.find((change) => change.id === 'a')).toMatchObject({ shelfId: null, position: 0 })
  })
})
