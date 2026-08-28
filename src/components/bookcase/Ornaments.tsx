import type { ShelfTheme } from '../../scenes/themes'

/**
 * The things living in the case besides the records.
 *
 * All of it is decoration and hidden from assistive technology. Motion is
 * CSS-only and stops under prefers-reduced-motion — a flame that will not
 * hold still is a problem for some people, not a flourish.
 */

/** A cobweb strung across a corner: radials, then the spiral catching them. */
export function Cobweb({
  size = 120,
  corner = 'tl',
  opacity = 0.3,
}: {
  size?: number
  corner?: 'tl' | 'tr'
  opacity?: number
}) {
  const rings = [0.3, 0.5, 0.68, 0.86]
  const spokes = 7

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{
        width: size,
        height: size,
        opacity,
        [corner === 'tl' ? 'left' : 'right']: 0,
        top: 0,
        transform: corner === 'tr' ? 'scaleX(-1)' : undefined,
      }}
    >
      <g stroke="#d8d4c8" strokeWidth="0.7" fill="none" strokeLinecap="round">
        {Array.from({ length: spokes }, (_, index) => {
          const angle = (index / (spokes - 1)) * (Math.PI / 2)
          return <line key={index} x1="0" y1="0" x2={Math.cos(angle) * 100} y2={Math.sin(angle) * 100} />
        })}
        {rings.map((r) => {
          // Each strand sags between its spokes, which is what stops a web
          // reading as a spiderweb-shaped decal.
          const points = Array.from({ length: spokes }, (_, index) => {
            const angle = (index / (spokes - 1)) * (Math.PI / 2)
            return [Math.cos(angle) * r * 100, Math.sin(angle) * r * 100]
          })
          const d = points
            .map(([x, y], index) => {
              if (index === 0) return `M${x},${y}`
              const [px, py] = points[index - 1]
              return `Q${(px + x) / 2 - r * 9},${(py + y) / 2 - r * 9} ${x},${y}`
            })
            .join(' ')
          return <path key={r} d={d} strokeWidth="0.55" />
        })}
      </g>
    </svg>
  )
}

/** A spider, hanging still on its thread until something disturbs it. */
export function Spider({ left, drop }: { left: string; drop: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 origin-top motion-safe:animate-[spider-drop_14s_ease-in-out_infinite]"
      style={{ left }}
    >
      <div className="mx-auto w-px bg-[#c9c4b6]/40" style={{ height: drop }} />
      <svg viewBox="0 0 24 20" className="-mt-px h-3 w-4" fill="none">
        <g stroke="#0d0a10" strokeWidth="1.4" strokeLinecap="round">
          <path d="M10,10 L3,5 M10,11 L2,10 M10,12 L3,16 M11,13 L7,19" />
          <path d="M14,10 L21,5 M14,11 L22,10 M14,12 L21,16 M13,13 L17,19" />
        </g>
        <ellipse cx="12" cy="11" rx="4.6" ry="4" fill="#0d0a10" />
        <circle cx="12" cy="6.6" r="2.4" fill="#160f18" />
      </svg>
    </div>
  )
}

/** A candle stub standing on a shelf, its flame breathing. */
export function Candle({
  height = 34,
  color,
  className = '',
}: {
  height?: number
  color: string
  className?: string
}) {
  return (
    <div aria-hidden="true" className={`pointer-events-none relative ${className}`}>
      {/* The pool of light it throws onto the shelf behind it */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl motion-safe:animate-[candle-glow_5s_ease-in-out_infinite]"
        style={{ width: height * 3.4, height: height * 3.4, background: `${color}44` }}
      />
      {/* Flame */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[50%] motion-safe:animate-[flame_2.7s_ease-in-out_infinite]"
        style={{
          width: height * 0.2,
          height: height * 0.42,
          top: -height * 0.34,
          background: `radial-gradient(ellipse at 50% 70%, #fff6df 0%, ${color} 55%, transparent 78%)`,
        }}
      />
      {/* Wax, guttered down one side */}
      <div
        className="mx-auto rounded-t-[2px]"
        style={{
          width: height * 0.26,
          height,
          background: `linear-gradient(100deg, #6d6455 0%, #e8dcc4 38%, #cabfa6 62%, #5c5446 100%)`,
        }}
      />
      <div
        className="mx-auto -mt-px rounded-b-[3px]"
        style={{
          width: height * 0.42,
          height: height * 0.12,
          background: 'linear-gradient(180deg, #d9cdb4, #6d6455)',
        }}
      />
    </div>
  )
}

/** Wax that has run down the shelf edge and set there. */
export function WaxDrip({ left, length, color }: { left: string; length: number; color: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-full"
      style={{ left }}
    >
      <div
        className="rounded-b-full"
        style={{
          width: 4,
          height: length,
          background: `linear-gradient(180deg, ${color}cc, ${color}55)`,
        }}
      />
    </div>
  )
}

/** Dust turning slowly in the light. */
export function DustMotes({ theme }: { theme: ShelfTheme }) {
  const motes = Array.from({ length: 18 }, (_, index) => {
    // Deterministic scatter, so the dust does not leap about on re-render.
    const a = Math.sin(index * 12.9898) * 43758.5453
    const b = Math.sin(index * 78.233) * 12345.6789
    return {
      left: `${Math.abs(a % 1) * 100}%`,
      top: `${Math.abs(b % 1) * 100}%`,
      delay: `${(index % 7) * 1.4}s`,
      size: 1 + (index % 3),
    }
  })

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((mote, index) => (
        <span
          key={index}
          className="absolute rounded-full motion-safe:animate-[mote_11s_ease-in-out_infinite]"
          style={{
            left: mote.left,
            top: mote.top,
            width: mote.size,
            height: mote.size,
            background: theme.candleColor,
            opacity: 0.28,
            animationDelay: mote.delay,
          }}
        />
      ))}
    </div>
  )
}
