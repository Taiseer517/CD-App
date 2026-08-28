import { animated, useSpring } from '@react-spring/three'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { DoubleSide, type Group } from 'three'
import type { CollectionItem } from '../data/schema'
import { useLabelTexture } from './hooks/useLabelTexture'
import { useSpineTexture } from './hooks/useSpineTexture'
import { useLazyTexture } from './hooks/useLazyTexture'
import type { PlacedCase, ShelfMode } from './layout'

const CASE_BODY: Record<CollectionItem['type'], string> = {
  cd: '#17121e',
  dvd: '#130d1c',
  vinyl: '#100d15',
}

const FALLBACK_GLOW = '#c22f3f'

interface MediaCaseProps {
  placed: PlacedCase
  mode: ShelfMode
  selected: boolean
  dragging: boolean
  reducedMotion: boolean
  onSelect: (item: CollectionItem) => void
  onDragStart: (item: CollectionItem, event: PointerEvent) => void
}

/** The disc, sliding out of a jewel case and turning under the light. */
function Disc({
  item,
  open,
  size,
  reducedMotion,
}: {
  item: CollectionItem
  open: boolean
  size: number
  reducedMotion: boolean
}) {
  const spinRef = useRef<Group>(null)
  const texture = useLazyTexture(item.discImageUrl || undefined)
  const radius = size * 0.44

  const spring = useSpring({
    x: open ? size * 0.86 : 0,
    tilt: open ? -0.22 : 0,
    config: { tension: 150, friction: 24 },
  })

  useFrame((_, delta) => {
    if (spinRef.current && open && !reducedMotion) spinRef.current.rotation.z += delta * 1.5
  })

  if (!open) return null

  return (
    <animated.group position-x={spring.x} position-z={-0.012} rotation-y={spring.tilt}>
      <group ref={spinRef}>
        <mesh>
          <circleGeometry args={[radius, 56]} />
          <meshStandardMaterial
            key={texture?.uuid ?? 'no-disc'}
            map={texture ?? undefined}
            color={texture ? '#ffffff' : '#c3bccf'}
            metalness={0.88}
            roughness={0.14}
            side={DoubleSide}
          />
        </mesh>
        {/* The data track catching light off-axis — the iridescent ring */}
        <mesh position={[0, 0, 0.0006]}>
          <ringGeometry args={[radius * 0.34, radius * 0.94, 56]} />
          <meshStandardMaterial
            color="#9fd2e8"
            metalness={1}
            roughness={0.08}
            transparent
            opacity={0.28}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.0014]}>
          <circleGeometry args={[radius * 0.17, 24]} />
          <meshBasicMaterial color="#07050a" />
        </mesh>
      </group>
    </animated.group>
  )
}

/** A record leaving its sleeve, turning at roughly 33rpm. */
function Record({
  item,
  open,
  size,
  reducedMotion,
}: {
  item: CollectionItem
  open: boolean
  size: number
  reducedMotion: boolean
}) {
  const spinRef = useRef<Group>(null)
  const labelTexture = useLazyTexture(item.discImageUrl || item.coverImageUrl || undefined)
  const radius = size * 0.47

  const spring = useSpring({
    x: open ? size * 0.84 : 0,
    config: { tension: 130, friction: 26 },
  })

  useFrame((_, delta) => {
    // 33⅓rpm is 3.49 rad/s; slowed, because at true speed the label smears.
    if (spinRef.current && open && !reducedMotion) spinRef.current.rotation.z += delta * 1.9
  })

  if (!open) return null

  return (
    <animated.group position-x={spring.x} position-z={-0.01}>
      <group ref={spinRef}>
        <mesh>
          <circleGeometry args={[radius, 64]} />
          <meshStandardMaterial color="#08080b" metalness={0.42} roughness={0.36} side={DoubleSide} />
        </mesh>
        {[0.95, 0.86, 0.77, 0.68, 0.59, 0.5].map((scale) => (
          <mesh key={scale} position={[0, 0, 0.0006]}>
            <ringGeometry args={[radius * scale - 0.003, radius * scale, 64]} />
            <meshBasicMaterial color="#25252c" transparent opacity={0.65} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.0014]}>
          <circleGeometry args={[radius * 0.35, 44]} />
          <meshStandardMaterial
            key={labelTexture?.uuid ?? 'no-label'}
            map={labelTexture ?? undefined}
            color={labelTexture ? '#ffffff' : '#3a1d5c'}
            roughness={0.82}
          />
        </mesh>
        <mesh position={[0, 0, 0.0022]}>
          <circleGeometry args={[radius * 0.034, 16]} />
          <meshBasicMaterial color="#07050a" />
        </mesh>
      </group>
    </animated.group>
  )
}

export function MediaCase({
  placed,
  mode,
  selected,
  dragging,
  reducedMotion,
  onSelect,
  onDragStart,
}: MediaCaseProps) {
  const { item, width, height, depth } = placed
  const [hovered, setHovered] = useState(false)
  const spineOut = mode === 'spine'
  /** Whether the sleeve faces are worth building at all. */
  const revealed = !spineOut || hovered || selected

  // Spine-out, the case is turned side-on; the box's own front face is then
  // its depth, so face and spine geometry swap roles.
  const faceWidth = spineOut ? depth : width
  const spineWidth = spineOut ? width : depth

  const front = useLazyTexture(revealed ? item.coverImageUrl || undefined : undefined)
  const back = useLazyTexture(revealed ? item.backCoverImageUrl || undefined : undefined)
  // Stands in for a sleeve with no scan yet — a film before TMDB is wired up,
  // or anything added by hand. Without it those cases are blank slabs.
  const label = useLabelTexture(
    revealed && !item.coverImageUrl,
    item.title,
    item.artistOrDirector,
    faceWidth / height,
  )
  const faceTexture = front ?? label
  const spine = useSpineTexture(spineOut, item.title, item.artistOrDirector, item.dominantColor)
  const glow = item.dominantColor || FALLBACK_GLOW

  // Pointer-down starts a drag, but a click must still select. Distinguished
  // by distance travelled, not timing, so a slow deliberate click still
  // selects and a quick flick still drags.
  const pressRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null)

  // Spine-out, the resting pose is turned a quarter-turn away. Hovering
  // rotates it back toward the viewer and eases it forward — the motion of
  // tipping a case out of a packed row to see what it is.
  const restRotation = spineOut ? -Math.PI / 2 : 0
  const spring = useSpring({
    z: selected ? 0.78 : hovered ? (spineOut ? 0.42 : 0.14) : 0,
    lift: selected ? height * 0.16 : hovered ? height * (spineOut ? 0.1 : 0.04) : 0,
    rotationY: selected ? Math.PI : hovered ? 0 : restRotation,
    scale: selected ? 1.16 : hovered ? (spineOut ? 1.08 : 1.045) : 1,
    tilt: hovered && !selected ? -0.13 : 0,
    emissive: selected ? 0.5 : hovered ? 0.34 : 0,
    config: reducedMotion
      ? { tension: 400, friction: 60 }
      : { tension: 190, friction: 22 },
  })

  function handlePointerDown(event: { stopPropagation: () => void; nativeEvent: PointerEvent }) {
    event.stopPropagation()
    pressRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, dragging: false }
  }

  function handlePointerMove(event: { nativeEvent: PointerEvent }) {
    const press = pressRef.current
    if (!press || press.dragging) return
    const travelled = Math.hypot(
      event.nativeEvent.clientX - press.x,
      event.nativeEvent.clientY - press.y,
    )
    if (travelled > 7) {
      press.dragging = true
      onDragStart(item, event.nativeEvent)
    }
  }

  function handlePointerUp(event: { stopPropagation: () => void }) {
    const press = pressRef.current
    pressRef.current = null
    if (!press || press.dragging) return
    event.stopPropagation()
    onSelect(item)
  }

  return (
    <animated.group
      position-x={placed.x}
      position-y={spring.lift.to((lift) => placed.y + lift)}
      position-z={spring.z}
      rotation-x={spring.tilt}
      rotation-y={spring.rotationY}
      scale={spring.scale}
      visible={!dragging}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* The case body. Packed spine-out and untouched, the box is hidden on
          all sides but one by its neighbours, so only that face is drawn —
          which halves the draw calls on a shelf of several hundred. */}
      {revealed && (
        <mesh>
          <boxGeometry args={[faceWidth, height, spineWidth]} />
          <animated.meshStandardMaterial
            color={CASE_BODY[item.type]}
            emissive={glow}
            emissiveIntensity={spring.emissive}
            roughness={item.type === 'vinyl' ? 0.93 : 0.36}
            metalness={item.type === 'vinyl' ? 0 : 0.18}
          />
        </mesh>
      )}

      {/* Front artwork, or a printed label when there is no scan. Packed
          spine-out and untouched, both faces are hidden by the neighbouring
          cases, so they are not built at all until one is tipped out. */}
      {revealed && (
        <mesh position={[0, 0, spineWidth / 2 + 0.001]}>
          <planeGeometry args={[faceWidth * 0.97, height * 0.97]} />
          <meshStandardMaterial
            key={faceTexture?.uuid ?? 'no-front'}
            map={faceTexture ?? undefined}
            color={faceTexture ? '#ffffff' : '#241a2e'}
            roughness={item.type === 'vinyl' ? 0.9 : 0.5}
          />
        </mesh>
      )}

      {/* Back artwork, turned so it reads correctly once the case is flipped */}
      {revealed && (
        <mesh position={[0, 0, -spineWidth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[faceWidth * 0.97, height * 0.97]} />
          <meshStandardMaterial
            key={back?.uuid ?? 'no-back'}
            map={back ?? undefined}
            color={back ? '#ffffff' : '#191122'}
            roughness={0.72}
          />
        </mesh>
      )}

      {/* The printed spine, on the face that meets the viewer when packed */}
      {spineOut && (
        <mesh position={[faceWidth / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[spineWidth * 0.99, height * 0.985]} />
          <meshStandardMaterial
            key={spine?.uuid ?? 'no-spine'}
            map={spine ?? undefined}
            color={spine ? '#ffffff' : glow}
            roughness={0.36}
            metalness={0.06}
          />
        </mesh>
      )}

      {item.type === 'vinyl' ? (
        <Record item={item} open={selected} size={faceWidth} reducedMotion={reducedMotion} />
      ) : (
        item.type === 'cd' && (
          <Disc
            item={item}
            open={selected}
            size={Math.min(faceWidth, height)}
            reducedMotion={reducedMotion}
          />
        )
      )}
    </animated.group>
  )
}
