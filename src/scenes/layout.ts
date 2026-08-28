import type { CollectionItem, Shelf } from '../data/schema'
import {
  CASE_DIMENSIONS,
  CASE_GAP,
  MAX_BOOKCASE_WIDTH,
  MIN_BOOKCASE_WIDTH,
  MIN_CASE_PITCH,
  PLANK_THICKNESS,
  SHELF_HEADROOM,
} from './dimensions'

export interface PlacedCase {
  item: CollectionItem
  /** Centre of the case, relative to the bookcase origin. */
  x: number
  y: number
  /** Slot index within the row, used when working out where a drag landed. */
  index: number
}

export interface RowLayout {
  /** null is the implicit Unfiled row, which always exists and cannot be deleted. */
  shelfId: string | null
  name: string
  accent: string
  /** Centre line of the row's usable space. */
  y: number
  height: number
  plankY: number
  pitch: number
  cases: PlacedCase[]
}

export interface BookcaseLayout {
  rows: RowLayout[]
  width: number
  height: number
}

export const UNFILED_NAME = 'Unfiled'

function rowHeight(items: CollectionItem[]): number {
  const tallest = items.reduce(
    (max, item) => Math.max(max, CASE_DIMENSIONS[item.type].height),
    CASE_DIMENSIONS.cd.height,
  )
  return tallest + SHELF_HEADROOM
}

/**
 * Spacing within a row. Cases sit side by side until the row is full, then the
 * pitch tightens and they overlap — the way records do when a shelf is packed
 * rather than the row silently growing wider than the bookcase.
 */
function widestCase(items: CollectionItem[]): number {
  return items.reduce((max, item) => Math.max(max, CASE_DIMENSIONS[item.type].width), 0)
}

function naturalPitch(items: CollectionItem[]): number {
  return items.length === 0 ? 0 : widestCase(items) + CASE_GAP
}

/** Total horizontal extent of a row: gaps between centres, plus one case. */
function spanAt(items: CollectionItem[], pitch: number): number {
  if (items.length === 0) return 0
  return (items.length - 1) * pitch + widestCase(items)
}

/**
 * Spacing within a row. Cases sit side by side until the row is full, then the
 * pitch tightens and they overlap — the way records do when a shelf is packed
 * rather than the row silently growing wider than the bookcase.
 */
function rowPitch(items: CollectionItem[], bookcaseWidth: number): number {
  if (items.length <= 1) return naturalPitch(items)
  const natural = naturalPitch(items)
  if (spanAt(items, natural) <= bookcaseWidth) return natural
  // Solve for the pitch that lands the row exactly on the inside edges.
  const fitted = (bookcaseWidth - widestCase(items)) / (items.length - 1)
  return Math.max(MIN_CASE_PITCH, fitted)
}

/**
 * Sizes the case to what it holds. A fixed width left a nine-record shelf
 * marooned in the middle of a bookcase built for forty, which pushed the
 * camera so far back the sleeves became unreadable.
 *
 * A row too long to fit even at the tightest pitch widens the whole case
 * past its normal maximum rather than being drawn overflowing its own frame.
 */
function deriveWidth(rows: CollectionItem[][]): number {
  let widestNatural = 0
  let widestCompressed = 0
  for (const items of rows) {
    widestNatural = Math.max(widestNatural, spanAt(items, naturalPitch(items)))
    widestCompressed = Math.max(widestCompressed, spanAt(items, MIN_CASE_PITCH))
  }

  const preferred = Math.min(MAX_BOOKCASE_WIDTH, widestNatural + 0.4)
  return Math.max(MIN_BOOKCASE_WIDTH, widestCompressed, preferred)
}

function sortForShelf(items: CollectionItem[]): CollectionItem[] {
  return [...items].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    // Ties happen for everything freshly imported, where every position is 0.
    return a.title.localeCompare(b.title)
  })
}

/**
 * Builds the bookcase top-down: named shelves in their chosen order, then
 * Unfiled last as the landing place for anything not yet put away.
 */
export function layoutBookcase(items: CollectionItem[], shelves: Shelf[]): BookcaseLayout {
  const owned = items.filter((item) => !item.wishlist)
  const byShelf = new Map<string | null, CollectionItem[]>()
  for (const item of owned) {
    const key = item.shelfId && shelves.some((shelf) => shelf.id === item.shelfId) ? item.shelfId : null
    const bucket = byShelf.get(key)
    if (bucket) bucket.push(item)
    else byShelf.set(key, [item])
  }

  const ordered = [...shelves].sort((a, b) => a.order - b.order)
  const definitions: { shelfId: string | null; name: string; accent: string }[] = ordered.map(
    (shelf) => ({ shelfId: shelf.id, name: shelf.name, accent: shelf.accent }),
  )
  definitions.push({ shelfId: null, name: UNFILED_NAME, accent: '' })

  const bookcaseWidth = deriveWidth(
    definitions.map((definition) => byShelf.get(definition.shelfId) ?? []),
  )

  const rows: RowLayout[] = []
  let cursor = 0

  for (const definition of definitions) {
    const rowItems = sortForShelf(byShelf.get(definition.shelfId) ?? [])
    // A named shelf stays visible while empty so there is somewhere to drop
    // things; Unfiled disappears once everything has been put away.
    if (definition.shelfId === null && rowItems.length === 0 && definitions.length > 1) continue

    const height = rowHeight(rowItems)
    const pitch = rowPitch(rowItems, bookcaseWidth)
    const span = Math.max(rowItems.length - 1, 0) * pitch
    const centreY = cursor - height / 2

    rows.push({
      shelfId: definition.shelfId,
      name: definition.name,
      accent: definition.accent,
      y: centreY,
      height,
      plankY: cursor - height - PLANK_THICKNESS / 2,
      pitch,
      cases: rowItems.map((item, index) => ({
        item,
        index,
        x: index * pitch - span / 2,
        // Cases rest on the plank rather than floating at the row's centre.
        y: cursor - height + SHELF_HEADROOM / 2 + CASE_DIMENSIONS[item.type].height / 2,
      })),
    })

    cursor -= height + PLANK_THICKNESS
  }

  return { rows, width: bookcaseWidth, height: Math.abs(cursor) }
}

/** Where in a row a case dropped at this x belongs. */
export function slotIndexAt(row: RowLayout, x: number): number {
  if (row.cases.length === 0) return 0
  const span = Math.max(row.cases.length - 1, 0) * row.pitch
  const raw = Math.round((x + span / 2) / row.pitch)
  return Math.max(0, Math.min(row.cases.length, raw))
}

/** Which row a drop at this height landed on. */
export function rowAt(layout: BookcaseLayout, y: number): RowLayout | null {
  let closest: RowLayout | null = null
  let bestDistance = Infinity
  for (const row of layout.rows) {
    const distance = Math.abs(row.y - y)
    if (distance < bestDistance) {
      bestDistance = distance
      closest = row
    }
  }
  return closest
}

/**
 * Recomputes positions after a case is dropped into a row at a slot. Returns
 * only the records whose placement actually changed, so a drag writes a
 * handful of rows rather than the whole collection.
 */
export function reindexAfterMove(
  layout: BookcaseLayout,
  movedId: string,
  targetShelfId: string | null,
  targetIndex: number,
): { id: string; shelfId: string | null; position: number }[] {
  const source = layout.rows.find((row) => row.cases.some((entry) => entry.item.id === movedId))
  const target = layout.rows.find((row) => row.shelfId === targetShelfId)
  if (!source || !target) return []

  const moved = source.cases.find((entry) => entry.item.id === movedId)!.item
  const remaining = target.cases.filter((entry) => entry.item.id !== movedId).map((entry) => entry.item)
  const clamped = Math.max(0, Math.min(remaining.length, targetIndex))
  remaining.splice(clamped, 0, moved)

  const changes: { id: string; shelfId: string | null; position: number }[] = []

  remaining.forEach((item, index) => {
    if (item.shelfId !== targetShelfId || item.position !== index) {
      changes.push({ id: item.id, shelfId: targetShelfId, position: index })
    }
  })

  if (source.shelfId !== targetShelfId) {
    source.cases
      .filter((entry) => entry.item.id !== movedId)
      .forEach((entry, index) => {
        if (entry.item.position !== index) {
          changes.push({ id: entry.item.id, shelfId: source.shelfId, position: index })
        }
      })
  }

  return changes
}
