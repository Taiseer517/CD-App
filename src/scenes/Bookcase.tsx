import { useMemo } from 'react'
import { Shape } from 'three'
import type { CollectionItem } from '../data/schema'
import { CROWN_HEIGHT, PLANK_DEPTH, PLANK_THICKNESS, SHELF_INSET } from './dimensions'
import type { BookcaseLayout, RowLayout } from './layout'
import { Candle } from './Candle'
import { usePlaqueTexture } from './hooks/usePlaqueTexture'
import type { ShelfTheme } from './themes'
import { MediaCase } from './MediaCase'


/** Beyond this, candles still burn but stop casting their own light. */
const MAX_LIT_CANDLES = 3

/** The pointed arch, as an outline that can be extruded or filled. */
function archShape(halfWidth: number, springing: number, rise: number): Shape {
  const shape = new Shape()
  shape.moveTo(-halfWidth, 0)
  shape.lineTo(-halfWidth, springing)
  // Two curves meeting at a point. A single centred arc would give the
  // rounded Romanesque arch, which is the wrong century entirely.
  shape.quadraticCurveTo(-halfWidth, springing + rise * 0.72, 0, springing + rise)
  shape.quadraticCurveTo(halfWidth, springing + rise * 0.72, halfWidth, springing)
  shape.lineTo(halfWidth, 0)
  return shape
}

/** Blind arcading carved into an upright — the repeated motif of a choir stall. */
function CarvedPanel({
  position,
  height,
  theme,
}: {
  position: [number, number, number]
  height: number
  theme: ShelfTheme
}) {
  const shape = useMemo(() => archShape(0.085, height * 0.42, height * 0.3), [height])
  return (
    <mesh position={position}>
      <extrudeGeometry args={[shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }]} />
      <meshLambertMaterial color={theme.woodLight} />
    </mesh>
  )
}

/** The crown: a great traceried arch with a rose window at its head. */
function Crown({ width, y, theme }: { width: number; y: number; theme: ShelfTheme }) {
  const rise = CROWN_HEIGHT - 0.2
  const outer = useMemo(() => archShape(width / 2, 0.1, rise), [width, rise])
  const inner = useMemo(() => archShape(width / 2 - 0.16, 0.08, rise - 0.2), [width, rise])

  return (
    <group position={[0, y, -PLANK_DEPTH / 2 + 0.06]}>
      <mesh>
        <extrudeGeometry args={[outer, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }]} />
        <meshStandardMaterial color={theme.wood} roughness={0.8} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.02, 0.05]}>
        <extrudeGeometry args={[inner, { depth: 0.12, bevelEnabled: false }]} />
        <meshStandardMaterial color={theme.woodDark} roughness={0.9} />
      </mesh>

      {/* Rose window: a hub with radiating spokes, gilt against the dark */}
      <group position={[0, rise * 0.52, 0.16]}>
        {/* Uplight so the tracery is legible instead of a dark silhouette */}
        <mesh>
          <ringGeometry args={[0.12, 0.16, 32]} />
          <meshStandardMaterial color={theme.metal} roughness={0.45} metalness={0.55} emissive={theme.rimColor} emissiveIntensity={0.25} />
        </mesh>
        {Array.from({ length: 8 }, (_, index) => (
          <mesh key={index} rotation={[0, 0, (index * Math.PI) / 4]}>
            <planeGeometry args={[0.28, 0.011]} />
            <meshStandardMaterial color={theme.metal} roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
        <mesh>
          <circleGeometry args={[0.062, 20]} />
          <meshStandardMaterial color="#3a1d5c" emissive="#5b2f8a" emissiveIntensity={0.45} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

/** The brass nameplate screwed to the front edge of a shelf. */
function ShelfPlaque({
  name,
  continued,
  y,
  x,
  theme,
}: {
  name: string
  continued: boolean
  y: number
  x: number
  theme: ShelfTheme
}) {
  const texture = usePlaqueTexture(name, continued)
  const width = 0.94
  const height = width * (96 / 512)

  return (
    <group position={[x, y, PLANK_DEPTH / 2 + 0.035]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          key={texture?.uuid ?? 'no-plaque'}
          map={texture ?? undefined}
          color={texture ? '#ffffff' : theme.metal}
          roughness={0.42}
          metalness={0.62}
        />
      </mesh>
      {/* Two screws, because a plate that floats reads as a sticker */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2 - side * 0.035, 0, 0.004]}>
          <circleGeometry args={[0.011, 8]} />
          <meshStandardMaterial color="#c9b98f" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** A turned finial capping each upright. */
function Finial({ x, y, theme }: { x: number; y: number; theme: ShelfTheme }) {
  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.055, 0.085, 0.1, 10]} />
        <meshStandardMaterial color={theme.woodLight} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <coneGeometry args={[0.07, 0.16, 10]} />
        <meshStandardMaterial color={theme.woodLight} roughness={0.7} metalness={0.08} />
      </mesh>
    </group>
  )
}

interface BookcaseProps {
  layout: BookcaseLayout
  theme: ShelfTheme
  /**
   * Vertical band, in bookcase-local coordinates, that the camera can see.
   * Rows outside it are skipped entirely — with several hundred records the
   * shelf runs to dozens of rows, and mounting them all is thousands of
   * meshes and textures for the four rows anyone is actually looking at.
   */
  band: { min: number; max: number }
  selectedId: string | null
  draggingId: string | null
  reducedMotion: boolean
  onSelect: (item: CollectionItem) => void
  onDragStart: (item: CollectionItem, event: PointerEvent) => void
  dropTarget: { shelfId: string | null; index: number } | null
}

function ShelfRow({
  row,
  width,
  selectedId,
  draggingId,
  reducedMotion,
  onSelect,
  onDragStart,
  dropTarget,
  lit,
  theme,
}: Omit<BookcaseProps, 'layout' | 'band'> & { row: RowLayout; width: number; lit: boolean }) {
  const showDropMarker =
    dropTarget !== null &&
    dropTarget.shelfId === row.shelfId &&
    dropTarget.index >= row.startIndex &&
    dropTarget.index <= row.startIndex + row.cases.length

  const markerSlot = (dropTarget?.index ?? 0) - row.startIndex
  const markerPosition = -width / 2 + SHELF_INSET + markerSlot * row.pitch - row.pitch * 0.06

  // Cases stack from the left, so the candle stands in whatever room is left
  // at the far end — and only where there is genuinely room for it.
  const usedTo =
    row.cases.length === 0
      ? -width / 2 + SHELF_INSET
      : Math.max(...row.cases.map((c) => c.x + c.width / 2))
  const candleSlot = width / 2 - 0.22
  const showCandles = candleSlot - usedTo > 0.3

  return (
    <group>
      <mesh position={[0, row.plankY, 0]}>
        <boxGeometry args={[width, PLANK_THICKNESS, PLANK_DEPTH]} />
        <meshLambertMaterial color={theme.wood} />
      </mesh>
      {/* Moulded front edge, which catches the candlelight and gives each
          shelf a readable horizon line in the dark. */}
      <mesh position={[0, row.plankY + PLANK_THICKNESS / 2 - 0.005, PLANK_DEPTH / 2 + 0.012]}>
        <boxGeometry args={[width, 0.05, 0.03]} />
        <meshStandardMaterial color={theme.woodLight} roughness={0.55} metalness={0.22} />
      </mesh>

      <ShelfPlaque
        name={row.name}
        continued={row.continued}
        y={row.plankY - 0.005}
        x={-width / 2 + 0.62}
        theme={theme}
      />

      {showCandles && theme.candles && (
        <Candle
          position={[candleSlot, row.plankY + PLANK_THICKNESS / 2, 0.24]}
          height={Math.min(0.3, row.caseHeight * 0.42)}
          seed={row.startIndex + (row.shelfId?.length ?? 3)}
          reducedMotion={reducedMotion}
          lit={lit}
          color={theme.candleColor}
        />
      )}

      {showDropMarker && (
        <mesh position={[markerPosition, row.y, PLANK_DEPTH / 2 - 0.24]}>
          <boxGeometry args={[0.018, row.caseHeight * 0.94, 0.018]} />
          <meshBasicMaterial color="#ff6b7d" />
        </mesh>
      )}

      {row.cases.map((placed) => (
        <MediaCase
          key={placed.item.id}
          placed={placed}
          mode={row.mode}
          selected={selectedId === placed.item.id}
          dragging={draggingId === placed.item.id}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      ))}
    </group>
  )
}

export function Bookcase({ layout, band, ...rowProps }: BookcaseProps) {
  const { theme } = rowProps
  const { rows, width, height } = layout
  const outerWidth = width + 0.66
  const centreY = -height / 2

  // Blind arcading repeated down each upright, at roughly eye-height spacing.
  const panelCount = Math.max(2, Math.floor(height / 0.72))

  return (
    <group>
      {/* Back panel */}
      <mesh position={[0, centreY, -PLANK_DEPTH / 2 - 0.01]}>
        <planeGeometry args={[outerWidth, height + 0.5]} />
        <meshLambertMaterial color={theme.woodDark} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[(side * outerWidth) / 2, centreY, 0]}>
            <boxGeometry args={[0.33, height + 0.5, PLANK_DEPTH]} />
            <meshLambertMaterial color={theme.wood} />
          </mesh>
          {Array.from({ length: panelCount }, (_, index) => (
            <CarvedPanel
              key={index}
              theme={theme}
              position={[
                (side * outerWidth) / 2,
                centreY + height / 2 - 0.46 - index * (height / panelCount),
                PLANK_DEPTH / 2 - 0.01,
              ]}
              height={0.34}
            />
          ))}
          <Finial x={(side * outerWidth) / 2} y={0.3} theme={theme} />
        </group>
      ))}

      {/* Cornice */}
      <mesh position={[0, 0.2, 0.02]}>
        <boxGeometry args={[outerWidth + 0.26, 0.17, PLANK_DEPTH + 0.14]} />
        <meshLambertMaterial color={theme.wood} />
      </mesh>
      <mesh position={[0, 0.09, PLANK_DEPTH / 2 + 0.07]}>
        <boxGeometry args={[outerWidth + 0.26, 0.05, 0.04]} />
        <meshStandardMaterial color={theme.metal} roughness={0.5} metalness={0.5} />
      </mesh>
      {theme.roseWindow && <Crown width={outerWidth} y={0.28} theme={theme} />}
      {/* One grazing light across the cornice and crown, from below */}
      <pointLight
        position={[0, 0.42, PLANK_DEPTH / 2 + 0.9]}
        color="#ffc98f"
        intensity={5}
        distance={4}
        decay={1.8}
      />

      {/* Plinth */}
      <mesh position={[0, centreY - height / 2 - 0.12, 0.02]}>
        <boxGeometry args={[outerWidth + 0.16, 0.22, PLANK_DEPTH + 0.1]} />
        <meshLambertMaterial color={theme.wood} />
      </mesh>

      {rows.map((row, index) => {
        const top = row.y + row.height / 2
        const bottom = row.y - row.height / 2
        if (bottom > band.max || top < band.min) return null

        return (
          <ShelfRow
            key={`${row.shelfId ?? 'unfiled'}-${row.startIndex}-${index}`}
            row={row}
            width={width}
            lit={index < MAX_LIT_CANDLES}
            {...rowProps}
          />
        )
      })}
    </group>
  )
}
