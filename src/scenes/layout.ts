import type { CollectionItem, Shelf } from '../data/schema'
import {
  aspectOf,
  bookcaseWidthFor,
  CASE_DIMENSIONS,
  CASE_GAP,
  CROWN_HEIGHT,
  PLANK_THICKNESS,
  PLINTH_HEIGHT,
  ROW_STANDARD_HEIGHT,
  SHELF_HEADROOM,
  SHELF_INSET,
  SPINE_GAP,
  SPINE_THICKNESS,
} from './dimensions'

/**
 * How a shelf is presenting its contents.
 *
 * A shelf displays its records face-out while there is room to, and packs
 * them spine-out once there is not — which is exactly what people do with a
 * real shelf, and the only way a few hundred discs fit at all.
 */
export type ShelfMode = 'face' | 'spine'

export interface PlacedCase {
  item: CollectionItem
  /** Centre of the case, relative to the bookcase origin. */
  x: number
  y: number
  /** Drawn size — every case in a row shares its height. */
  width: number
  height: number
  depth: number
  /** Position within the whole shelf, not just this visual row. */
  index: number
}

export interface RowLayout {
  /** Width of the bookcase this row belongs to. */
  width: number
  mode: ShelfMode
  /** null is the implicit Unfiled row, which cannot be renamed or deleted. */
  shelfId: string | null
  name: string
  accent: string
  /** Centre line of the row's usable space. */
  y: number
  height: number
  /** Shared drawn height of every case in this row. */
  caseHeight: number
  plankY: number
  pitch: number
  /** Where this visual row starts within its shelf, for a shelf that spilled. */
  startIndex: number
  /** True when this row is a continuation of the shelf above it. */
  continued: boolean
  cases: PlacedCase[]
}

export interface BookcaseLayout {
  rows: RowLayout[]
  width: number
  height: number
  /** Full drawn extent including crown and plinth, for framing the camera. */
  extentTop: number
  extentBottom: number
}

/** Centre of a case standing in a given slot, measured from the bookcase mid-line. */
export function slotX(index: number, pitch: number, caseWidth: number, width: number): number {
  return -width / 2 + SHELF_INSET + index * pitch + caseWidth / 2
}

export const UNFILED_NAME = 'Unfiled'

/**
 * The height every case in this row is drawn at, taken from the *commonest*
 * medium on the shelf rather than the tallest.
 *
 * A shelf is a fixed opening in a real bookcase, and one record filed among
 * three hundred CDs should not resize the opening — sizing by the tallest
 * item made every CD render at 12-inch scale and turned the case into a
 * hundred-row tower.
 */
function standardHeight(items: CollectionItem[]): number {
  if (items.length === 0) return ROW_STANDARD_HEIGHT.cd

  const tally = new Map<CollectionItem['type'], number>()
  for (const item of items) tally.set(item.type, (tally.get(item.type) ?? 0) + 1)

  let commonest: CollectionItem['type'] = 'cd'
  let best = 0
  for (const [type, count] of tally) {
    if (count > best) {
      best = count
      commonest = type
    }
  }
  return ROW_STANDARD_HEIGHT[commonest]
}

/** Drawn width of one case once scaled to the row's shared height. */
function drawnWidth(item: CollectionItem, height: number): number {
  return height * aspectOf(item.type)
}

function widestCase(items: CollectionItem[], height: number): number {
  return items.reduce((max, item) => Math.max(max, drawnWidth(item, height)), 0)
}

/**
 * How many cases fit across the bookcase at comfortable spacing. A shelf
 * holding more than this spills onto a continuation row rather than squeezing
 * its contents into an unreadable smear — the bookcase is a fixed piece of
 * furniture, so it is the shelving that gives, exactly as it would in a room.
 */
/** Drawn thickness of a spine, scaled to the row's shared height. */
function spineWidth(item: CollectionItem, height: number): number {
  return SPINE_THICKNESS[item.type] * (height / ROW_STANDARD_HEIGHT[item.type])
}

function widestSpine(items: CollectionItem[], height: number): number {
  return items.reduce((max, item) => Math.max(max, spineWidth(item, height)), 0)
}

function capacityFor(pitch: number, widest: number, width: number): number {
  const usable = width - SHELF_INSET * 2
  return Math.max(1, Math.floor((usable - widest) / pitch) + 1)
}

function sortForShelf(items: CollectionItem[]): CollectionItem[] {
  return [...items].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    // Ties happen for everything freshly imported, where every position is 0.
    return a.title.localeCompare(b.title)
  })
}

/** Every item on a shelf, in shelf order, across all its visual rows. */
export function itemsOnShelf(layout: BookcaseLayout, shelfId: string | null): CollectionItem[] {
  return layout.rows
    .filter((row) => row.shelfId === shelfId)
    .flatMap((row) => row.cases)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.item)
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

  const largestShelf = Math.max(
    0,
    ...definitions.map((definition) => (byShelf.get(definition.shelfId) ?? []).length),
  )
  const bookcaseWidth = bookcaseWidthFor(largestShelf)

  const rows: RowLayout[] = []
  let cursor = 0

  for (const definition of definitions) {
    const shelfItems = sortForShelf(byShelf.get(definition.shelfId) ?? [])
    // A named shelf stays visible while empty so there is somewhere to drop
    // things; Unfiled disappears once everything has been put away.
    if (definition.shelfId === null && shelfItems.length === 0 && definitions.length > 1) continue

    const caseHeight = standardHeight(shelfItems)

    const faceWidest = widestCase(shelfItems, caseHeight)
    const facePitch = faceWidest + CASE_GAP
    const faceCapacity = capacityFor(facePitch, faceWidest, bookcaseWidth)

    // Face-out while one row can hold everything; spine-out once it cannot.
    const mode: ShelfMode = shelfItems.length <= faceCapacity ? 'face' : 'spine'

    const spineWidest = widestSpine(shelfItems, caseHeight)
    const pitch = mode === 'face' ? facePitch : spineWidest + SPINE_GAP
    const widest = mode === 'face' ? faceWidest : spineWidest
    const capacity = mode === 'face' ? faceCapacity : capacityFor(pitch, widest, bookcaseWidth)
    const chunkCount = Math.max(1, Math.ceil(shelfItems.length / capacity))

    for (let chunk = 0; chunk < chunkCount; chunk++) {
      const startIndex = chunk * capacity
      const chunkItems = shelfItems.slice(startIndex, startIndex + capacity)
      const height = caseHeight + SHELF_HEADROOM

      rows.push({
        width: bookcaseWidth,
        mode,
        shelfId: definition.shelfId,
        name: definition.name,
        accent: definition.accent,
        y: cursor - height / 2,
        height,
        caseHeight,
        plankY: cursor - height - PLANK_THICKNESS / 2,
        pitch: pitch || CASE_GAP,
        startIndex,
        continued: chunk > 0,
        cases: chunkItems.map((item, offset) => {
          const drawn =
            mode === 'face' ? drawnWidth(item, caseHeight) : spineWidth(item, caseHeight)
          return {
            item,
            index: startIndex + offset,
            width: drawn,
            height: caseHeight,
            depth: mode === 'face' ? CASE_DIMENSIONS[item.type].depth : drawnWidth(item, caseHeight),
            x: slotX(offset, pitch, drawn, bookcaseWidth),
            // Cases rest on the plank rather than floating at the row's centre.
            y: cursor - height + SHELF_HEADROOM / 2 + caseHeight / 2,
          }
        }),
      })

      cursor -= height + PLANK_THICKNESS
    }
  }

  const height = Math.abs(cursor)
  return {
    rows,
    width: bookcaseWidth,
    height,
    extentTop: CROWN_HEIGHT,
    extentBottom: -(height + PLINTH_HEIGHT),
  }
}

/** Where in the whole shelf a case dropped at this x on this row belongs. */
export function slotIndexAt(row: RowLayout, x: number): number {
  if (row.cases.length === 0) return row.startIndex
  const local = Math.round((x + row.width / 2 - SHELF_INSET) / row.pitch)
  return row.startIndex + Math.max(0, Math.min(row.cases.length, local))
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
 * Recomputes positions after a case is dropped into a shelf at a slot. Returns
 * only the records whose placement actually changed, so a drag writes a
 * handful of rows rather than the whole collection.
 */
export function reindexAfterMove(
  layout: BookcaseLayout,
  movedId: string,
  targetShelfId: string | null,
  targetIndex: number,
): { id: string; shelfId: string | null; position: number }[] {
  const sourceRow = layout.rows.find((row) => row.cases.some((entry) => entry.item.id === movedId))
  if (!sourceRow) return []
  const moved = sourceRow.cases.find((entry) => entry.item.id === movedId)!.item
  const sourceShelfId = sourceRow.shelfId

  const target = itemsOnShelf(layout, targetShelfId).filter((item) => item.id !== movedId)
  const clamped = Math.max(0, Math.min(target.length, targetIndex))
  target.splice(clamped, 0, moved)

  const changes: { id: string; shelfId: string | null; position: number }[] = []

  target.forEach((item, index) => {
    if (item.shelfId !== targetShelfId || item.position !== index) {
      changes.push({ id: item.id, shelfId: targetShelfId, position: index })
    }
  })

  if (sourceShelfId !== targetShelfId) {
    itemsOnShelf(layout, sourceShelfId)
      .filter((item) => item.id !== movedId)
      .forEach((item, index) => {
        if (item.position !== index) {
          changes.push({ id: item.id, shelfId: sourceShelfId, position: index })
        }
      })
  }

  return changes
}
