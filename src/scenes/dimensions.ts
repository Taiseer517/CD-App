import type { MediaType } from '../data/schema'

/**
 * World units at 1 unit = 20cm, taken from the real objects so a 12" record
 * towers over a jewel case the way it does on an actual shelf.
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

/** Clearance between a row's tallest case and the plank above it. */
export const SHELF_HEADROOM = 0.28
export const PLANK_THICKNESS = 0.08
export const PLANK_DEPTH = 1.9
/** The case is sized to its contents between these bounds, not fixed wide. */
export const MIN_BOOKCASE_WIDTH = 4.5
export const MAX_BOOKCASE_WIDTH = 12
export const CASE_GAP = 0.14

/** Below this the row is squeezed and cases start to overlap on purpose. */
export const MIN_CASE_PITCH = 0.22
