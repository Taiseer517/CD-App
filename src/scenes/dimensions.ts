import type { MediaType } from '../data/schema'

/**
 * Real proportions of the physical objects, at 1 unit = 20cm.
 * Only the aspect ratio is used directly — see standardHeight below for why.
 */
export interface CaseDimensions {
  width: number
  height: number
  depth: number
}

export const CASE_DIMENSIONS: Record<MediaType, CaseDimensions> = {
  cd: { width: 0.62, height: 0.71, depth: 0.05 },
  dvd: { width: 0.68, height: 0.95, depth: 0.07 },
  vinyl: { width: 1.58, height: 1.58, depth: 0.03 },
}

export function aspectOf(type: MediaType): number {
  return CASE_DIMENSIONS[type].width / CASE_DIMENSIONS[type].height
}

/**
 * Every case in a row is drawn to the same height, keeping its own aspect
 * ratio. This is how a real rack reads — spines and sleeves level with one
 * another — and it is what stops a CD dropped onto a record shelf from
 * looking like a mistake instead of a choice.
 */
export const ROW_STANDARD_HEIGHT: Record<MediaType, number> = {
  cd: 0.78,
  dvd: 0.9,
  vinyl: 1.5,
}

export const SHELF_HEADROOM = 0.34
export const PLANK_THICKNESS = 0.09
export const PLANK_DEPTH = 1.7

/**
 * The bookcase is a fixed piece of furniture, not something that resizes.
 * Narrow and tall like a real CD rack — a wide one leaves a handful of discs
 * marooned in the middle of an empty plank.
 */
/**
 * Furniture comes in sizes. A handful of records gets a cosy case; a serious
 * collection gets a library wall. Stepped rather than continuous so it still
 * reads as a solid object rather than something that breathes with the data.
 */
export function bookcaseWidthFor(largestShelf: number): number {
  if (largestShelf <= 14) return 5.6
  if (largestShelf <= 70) return 7.6
  return 9.8
}

/** Default used by anything that needs a width before the layout is known. */
export const BOOKCASE_WIDTH = 5.6
export const CASE_GAP = 0.055

/** Records stack from the left, against the upright, the way books do. */
export const SHELF_INSET = 0.13

/** Vertical extent of the crown above the cornice, and the plinth below. */
export const CROWN_HEIGHT = 1.15
export const PLINTH_HEIGHT = 0.42
