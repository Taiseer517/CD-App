/**
 * Reusable clip paths for the wall's arched niches.
 *
 * Built from two circular arcs meeting at a point rather than quadratic
 * curves: a quadratic whose control point sits out near the springing rounds
 * the apex off into a Romanesque arch, and the point is the whole idea.
 * Each arc is struck from the opposite springing line, which is how an
 * equilateral gothic arch is actually set out.
 */
export const ARCH_CLIP_ID = 'gothic-arch-clip'
export const ARCH_INNER_CLIP_ID = 'gothic-arch-inner-clip'

const ARCH = 'M0,1 L0,0.44 A1,0.51 0 0 1 0.5,0 A1,0.51 0 0 1 1,0.44 L1,1 Z'
const ARCH_INNER =
  'M0.05,1 L0.05,0.45 A0.9,0.46 0 0 1 0.5,0.05 A0.9,0.46 0 0 1 0.95,0.45 L0.95,1 Z'

export function ArchClip() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        <clipPath id={ARCH_CLIP_ID} clipPathUnits="objectBoundingBox">
          <path d={ARCH} />
        </clipPath>
        <clipPath id={ARCH_INNER_CLIP_ID} clipPathUnits="objectBoundingBox">
          <path d={ARCH_INNER} />
        </clipPath>
      </defs>
    </svg>
  )
}
