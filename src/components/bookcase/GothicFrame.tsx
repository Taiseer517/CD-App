/**
 * The bookcase itself, drawn rather than modelled.
 *
 * A real-time 3D bookcase spent its whole budget on geometry simple enough to
 * hit sixty frames a second and still looked like painted boxes. None of that
 * furniture ever moves, so drawing it buys far more detail for far less. The
 * discs stay 3D, because those are the things you actually pick up and turn.
 *
 * Carving reads through tone, not outline: every moulding is several strokes
 * of descending lightness, so an edge has a lit top and a shadowed underside
 * the way a cut profile does. Decorative throughout, hidden from assistive
 * technology; the records are ordinary DOM laid over it.
 */

interface GothicFrameProps {
  wood: string
  woodDark: string
  woodLight: string
  metal: string
  /** Height of the shelf area. Everything else is fixed and derived from it. */
  openingHeight: number
}

const W = 1000

/**
 * The ornament is a fixed height and the shelf area is what grows, so the
 * cornice, gable and arch keep their proportions whether the case holds one
 * shelf or eight. Deriving the other way round — a fixed geometry inside a
 * variable height — made the gable swallow the whole arch on a short case.
 */
const CORNICE_TOP = 40
const APEX = 300
const SPRINGING = 530
const PLINTH = 118

export function frameGeometry(openingHeight: number) {
  const floor = SPRINGING + openingHeight
  return {
    height: floor + PLINTH,
    /** Where the shelves may start, clear of the arch mouldings. */
    openingTop: SPRINGING,
    floor,
  }
}

/** Leaf crockets climbing a gable — the signature of Gothic Revival carving. */
function Crockets({
  from,
  to,
  count,
  fill,
  shade,
}: {
  from: [number, number]
  to: [number, number]
  count: number
  fill: string
  shade: string
}) {
  const dir = Math.sign(to[0] - from[0]) || 1
  return (
    <g>
      {Array.from({ length: count }, (_, index) => {
        const t = (index + 0.6) / (count + 0.4)
        const x = from[0] + (to[0] - from[0]) * t
        const y = from[1] + (to[1] - from[1]) * t
        const s = 11 + (1 - t) * 10
        const leaf = `M0,0 c${dir * s * 0.1},${-s * 0.85} ${dir * s * 0.95},${-s * 0.95} ${dir * s * 1.15},${-s * 0.2}
                      c${-dir * s * 0.3},${-s * 0.3} ${-dir * s * 0.75},${s * 0.05} ${-dir * s * 1.15},${s * 0.2} z`
        return (
          <g key={index} transform={`translate(${x},${y})`}>
            <path d={leaf} fill={shade} transform="translate(0,3)" />
            <path d={leaf} fill={fill} />
          </g>
        )
      })}
    </g>
  )
}

export function GothicFrame({ wood, woodDark, woodLight, metal, openingHeight }: GothicFrameProps) {
  const { height, floor } = frameGeometry(openingHeight)
  const left = 104
  const right = W - 104
  const apex = APEX
  const springing = SPRINGING
  const mid = W / 2

  const opening = `M${left},${floor} L${left},${springing}
    C${left},${springing - 150} ${mid - 150},${apex + 30} ${mid},${apex}
    C${mid + 150},${apex + 30} ${right},${springing - 150} ${right},${springing}
    L${right},${floor} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        {/* Quartersawn oak: light down the centre of the board, dark at the
            edges where it turns away. */}
        <linearGradient id="oak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={woodDark} />
          <stop offset="18%" stopColor={wood} />
          <stop offset="46%" stopColor={woodLight} />
          <stop offset="72%" stopColor={wood} />
          <stop offset="100%" stopColor={woodDark} />
        </linearGradient>
        <linearGradient id="post" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={woodDark} />
          <stop offset="34%" stopColor={woodLight} />
          <stop offset="62%" stopColor={wood} />
          <stop offset="100%" stopColor={woodDark} />
        </linearGradient>
        <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={woodLight} />
          <stop offset="40%" stopColor={wood} />
          <stop offset="100%" stopColor={woodDark} />
        </linearGradient>
        <radialGradient id="cavity" cx="0.5" cy="0.34" r="0.85">
          <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#000" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.97" />
        </radialGradient>

        {/* Grain, drawn along the boards rather than across them. */}
        <filter id="grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.42" numOctaves="4" seed="11" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.055" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="atop" />
        </filter>

        <filter id="relief" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.85" />
        </filter>

        <clipPath id="opening">
          <path d={opening} />
        </clipPath>
      </defs>

      {/* The carcass */}
      <rect x="0" y="0" width={W} height={height} fill="url(#oak)" filter="url(#grain)" />

      {/* The recess behind the shelves */}
      <g clipPath="url(#opening)">
        <rect x="0" y="0" width={W} height={height} fill={woodDark} />
        {Array.from({ length: 13 }, (_, index) => (
          <rect
            key={index}
            x={left + index * ((right - left) / 13)}
            y={apex}
            width="2"
            height={floor - apex}
            fill="#000"
            opacity="0.4"
          />
        ))}
        <rect x="0" y="0" width={W} height={height} fill="url(#cavity)" />
      </g>

      {/* Moulding round the opening: four strokes of falling tone, which is
          what makes it read as a cut profile rather than a drawn line. */}
      <path d={opening} fill="none" stroke="#000" strokeOpacity="0.8" strokeWidth="20" />
      <path d={opening} fill="none" stroke={woodLight} strokeWidth="13" />
      <path d={opening} fill="none" stroke={wood} strokeWidth="7" />
      <path d={opening} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="2.5" />

      <g filter="url(#relief)">
        {/* Gable over the arch */}
        <path
          d={`M${mid},${apex - 168} L${right - 40},${apex + 34}
              L${right - 74},${apex + 34} L${mid},${apex - 126}
              L${left + 74},${apex + 34} L${left + 40},${apex + 34} Z`}
          fill={woodLight}
        />
        <Crockets from={[mid, apex - 158]} to={[right - 52, apex + 28]} count={5} fill={woodLight} shade={woodDark} />
        <Crockets from={[mid, apex - 158]} to={[left + 52, apex + 28]} count={5} fill={woodLight} shade={woodDark} />

        {/* Finial */}
        <path d={`M${mid},${apex - 236} l15,30 l-7,0 l12,26 l-40,0 l12,-26 l-7,0 z`} fill={woodLight} />
        <circle cx={mid} cy={apex - 178} r="10" fill={metal} />

        {/* Pierced quatrefoils in the spandrels */}
        {[left - 52, right + 52].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={springing - 190} r="30" fill={woodDark} />
            {[0, 90, 180, 270].map((deg) => {
              const rad = (deg * Math.PI) / 180
              return (
                <circle
                  key={deg}
                  cx={cx + Math.cos(rad) * 15}
                  cy={springing - 190 + Math.sin(rad) * 15}
                  r="13"
                  fill={woodDark}
                />
              )
            })}
            <circle cx={cx} cy={springing - 190} r="30" fill="none" stroke={woodLight} strokeWidth="4" />
          </g>
        ))}

        {/* Carved scroll in each upper corner */}
        {[0, 1].map((side) => {
          const s = side ? -1 : 1
          const ox = side ? W - 40 : 40
          return (
            <g key={side}>
              {[6, 0].map((offset, layer) => (
                <path
                  key={offset}
                  transform={`translate(0,${offset})`}
                  d={`M${ox},${apex - 120} c${s * 40},8 ${s * 58},44 ${s * 42},84
                      c${-s * 12},30 ${-s * 46},28 ${-s * 49},2
                      c${-s * 3},-21 ${s * 25},-28 ${s * 33},-10`}
                  fill="none"
                  stroke={layer === 0 ? woodDark : woodLight}
                  strokeWidth="13"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )
        })}

        {/* Cornice with dentils */}
        <rect x="0" y={CORNICE_TOP} width={W} height="30" fill={woodLight} />
        <rect x="0" y={CORNICE_TOP + 28} width={W} height="8" fill={metal} opacity="0.6" />
        {Array.from({ length: 30 }, (_, index) => (
          <rect
            key={index}
            x={14 + index * ((W - 28) / 30)}
            y={CORNICE_TOP + 38}
            width={(W - 28) / 30 - 9}
            height="16"
            fill={woodDark}
          />
        ))}
        <rect x="0" y={CORNICE_TOP + 56} width={W} height="10" fill={wood} />

        {/* Pinnacles along the cornice */}
        {[0.08, 0.26, 0.74, 0.92].map((t) => (
          <g key={t}>
            <path d={`M${W * t},${CORNICE_TOP - 62} l12,26 l-5,0 l9,24 l-32,0 l9,-24 l-5,0 z`} fill={woodLight} />
            <rect x={W * t - 13} y={CORNICE_TOP - 14} width="26" height="14" fill={wood} />
          </g>
        ))}

        {/* Uprights flanking the opening */}
        {[left - 52, right + 52].map((x) => (
          <g key={x}>
            <rect x={x - 20} y={springing - 120} width="40" height={floor - springing + 120} fill="url(#post)" />
            <path d={`M${x - 30},${springing - 118} h60 l-8,26 h-44 z`} fill={woodLight} />
            <path d={`M${x - 30},${floor} h60 l-8,-26 h-44 z`} fill={woodLight} />
          </g>
        ))}

        {/* Plinth */}
        <rect x="0" y={floor} width={W} height="26" fill={woodLight} />
        <rect x="0" y={floor + 24} width={W} height={height - floor - 24} fill="url(#rail)" />
        {Array.from({ length: 4 }, (_, index) => (
          <rect
            key={index}
            x={90 + index * ((W - 180) / 4)}
            y={floor + 40}
            width={(W - 180) / 4 - 34}
            height={height - floor - 60}
            fill={woodDark}
            opacity="0.8"
            rx="2"
          />
        ))}
      </g>
    </svg>
  )
}
