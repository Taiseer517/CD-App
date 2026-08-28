import { useMemo } from 'react'
import { Shape } from 'three'
import type { CollectionItem } from '../data/schema'
import { PLANK_DEPTH, PLANK_THICKNESS } from './dimensions'
import type { BookcaseLayout, RowLayout } from './layout'
import { MediaCase } from './MediaCase'

const WOOD = '#251c30'
const WOOD_DARK = '#150f1c'

/**
 * A pointed gothic arch, built as an extruded shape rather than drawn on a
 * texture so it catches the candlelight along its edge.
 */
function ArchCrown({ width, y }: { width: number; y: number }) {
  const shape = useMemo(() => {
    const half = width / 2
    const rise = width * 0.34
    const outline = new Shape()

    outline.moveTo(-half, 0)
    outline.lineTo(-half, rise * 0.35)
    // Two arcs meeting at a point: the defining move of the gothic arch,
    // as opposed to the single centred semicircle of a Romanesque one.
    outline.quadraticCurveTo(-half * 0.52, rise * 0.98, 0, rise * 1.25)
    outline.quadraticCurveTo(half * 0.52, rise * 0.98, half, rise * 0.35)
    outline.lineTo(half, 0)

    const inner = new Shape()
    const innerHalf = half * 0.86
    const innerRise = rise * 0.86
    inner.moveTo(-innerHalf, 0.02)
    inner.lineTo(-innerHalf, innerRise * 0.35)
    inner.quadraticCurveTo(-innerHalf * 0.52, innerRise * 0.98, 0, innerRise * 1.25)
    inner.quadraticCurveTo(innerHalf * 0.52, innerRise * 0.98, innerHalf, innerRise * 0.35)
    inner.lineTo(innerHalf, 0.02)
    outline.holes.push(inner)

    return outline
  }, [width])

  return (
    <mesh position={[0, y, -PLANK_DEPTH / 2 + 0.1]}>
      <extrudeGeometry args={[shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }]} />
      <meshStandardMaterial color={WOOD} roughness={0.85} metalness={0.05} />
    </mesh>
  )
}

interface BookcaseProps {
  layout: BookcaseLayout
  selectedId: string | null
  draggingId: string | null
  searchActive: boolean
  matchedIds: Set<string>
  onSelect: (item: CollectionItem) => void
  onDragStart: (item: CollectionItem, event: PointerEvent) => void
  dropTarget: { shelfId: string | null; index: number } | null
}

function ShelfRow({
  row,
  selectedId,
  draggingId,
  searchActive,
  matchedIds,
  onSelect,
  onDragStart,
  dropTarget,
  width,
}: Omit<BookcaseProps, 'layout'> & { row: RowLayout; width: number }) {
  const showDropMarker = dropTarget !== null && dropTarget.shelfId === row.shelfId
  const span = Math.max(row.cases.length - 1, 0) * row.pitch
  const markerX = showDropMarker ? dropTarget.index * row.pitch - span / 2 - row.pitch / 2 : 0

  return (
    <group>
      {/* The plank this row rests on */}
      <mesh position={[0, row.plankY, 0]} receiveShadow>
        <boxGeometry args={[width, PLANK_THICKNESS, PLANK_DEPTH]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} metalness={0.04} />
      </mesh>

      {/* A lip along the front edge, which catches the key light and gives the
          shelf a readable horizon line in the dark. */}
      <mesh position={[0, row.plankY + PLANK_THICKNESS / 2, PLANK_DEPTH / 2]}>
        <boxGeometry args={[width, 0.035, 0.05]} />
        <meshStandardMaterial color="#2a2136" roughness={0.6} metalness={0.2} />
      </mesh>

      {showDropMarker && (
        <mesh position={[markerX, row.y, PLANK_DEPTH / 2 - 0.3]}>
          <boxGeometry args={[0.02, row.height * 0.8, 0.02]} />
          <meshBasicMaterial color="#e35263" />
        </mesh>
      )}

      {row.cases.map((placed) => (
        <MediaCase
          key={placed.item.id}
          item={placed.item}
          position={[placed.x, placed.y, 0]}
          selected={selectedId === placed.item.id}
          dragging={draggingId === placed.item.id}
          dimmed={searchActive && !matchedIds.has(placed.item.id)}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      ))}
    </group>
  )
}

export function Bookcase({ layout, ...rowProps }: BookcaseProps) {
  const { rows, width, height } = layout
  const outerWidth = width + 0.6
  const centreY = -height / 2

  return (
    <group>
      {/* Back panel, set behind the cases so the room does not show through */}
      <mesh position={[0, centreY, -PLANK_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[outerWidth, height + 0.4]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.95} />
      </mesh>

      {/* Uprights */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * outerWidth) / 2, centreY, 0]} castShadow>
          <boxGeometry args={[0.3, height + 0.4, PLANK_DEPTH]} />
          <meshStandardMaterial color={WOOD} roughness={0.88} metalness={0.05} />
        </mesh>
      ))}

      {/* Cornice and crown */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[outerWidth + 0.2, 0.16, PLANK_DEPTH + 0.1]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} metalness={0.06} />
      </mesh>
      <ArchCrown width={outerWidth} y={0.3} />

      {rows.map((row) => (
        <ShelfRow key={row.shelfId ?? 'unfiled'} row={row} width={width} {...rowProps} />
      ))}
    </group>
  )
}
