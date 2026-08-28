import { animated, useSpring } from '@react-spring/three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { DoubleSide, type Group, type Mesh } from 'three'
import type { CollectionItem } from '../data/schema'
import { CASE_DIMENSIONS } from './dimensions'
import { useLabelTexture } from './hooks/useLabelTexture'
import { useLazyTexture } from './hooks/useLazyTexture'

const CASE_BODY: Record<CollectionItem['type'], string> = {
  cd: '#15111b',
  dvd: '#120c1a',
  vinyl: '#0f0c13',
}

const FALLBACK_GLOW = '#c22f3f'

interface MediaCaseProps {
  item: CollectionItem
  position: [number, number, number]
  selected: boolean
  dragging: boolean
  dimmed: boolean
  onSelect: (item: CollectionItem) => void
  onDragStart: (item: CollectionItem, event: PointerEvent) => void
}

/**
 * The disc inside a jewel case. Slides out and turns when the case is opened,
 * catching the light off-axis the way a real CD does.
 */
function Disc({ item, open }: { item: CollectionItem; open: boolean }) {
  const meshRef = useRef<Mesh>(null)
  const texture = useLazyTexture(item.discImageUrl || undefined)
  const radius = CASE_DIMENSIONS.cd.height * 0.42

  const spring = useSpring({
    x: open ? CASE_DIMENSIONS.cd.width * 0.78 : 0,
    opacity: open ? 1 : 0,
    config: { tension: 170, friction: 26 },
  })

  useFrame((_, delta) => {
    if (meshRef.current && open) meshRef.current.rotation.z += delta * 1.4
  })

  if (!open) return null

  return (
    <animated.group position-x={spring.x} position-z={-0.01}>
      <mesh ref={meshRef}>
        <circleGeometry args={[radius, 48]} />
        <meshStandardMaterial
          key={texture?.uuid ?? 'no-disc'}
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#b9b4c4'}
          metalness={0.85}
          roughness={0.18}
          side={DoubleSide}
        />
      </mesh>
      {/* The spindle hole, so the disc doesn't read as a plain coin. */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[radius * 0.16, 24]} />
        <meshBasicMaterial color="#07050a" />
      </mesh>
    </animated.group>
  )
}

/** A record leaving its sleeve, spinning at roughly 33rpm. */
function Record({ item, open }: { item: CollectionItem; open: boolean }) {
  const meshRef = useRef<Mesh>(null)
  const labelTexture = useLazyTexture(item.discImageUrl || item.coverImageUrl || undefined)
  const radius = CASE_DIMENSIONS.vinyl.width * 0.47

  const spring = useSpring({
    x: open ? CASE_DIMENSIONS.vinyl.width * 0.82 : 0,
    config: { tension: 150, friction: 28 },
  })

  useFrame((_, delta) => {
    // 33⅓ rpm is 3.49 rad/s. Slowed a little; at true speed the label smears.
    if (meshRef.current && open) meshRef.current.rotation.z += delta * 1.9
  })

  if (!open) return null

  return (
    <animated.group position-x={spring.x} position-z={-0.008}>
      <group ref={meshRef as never}>
        <mesh>
          <circleGeometry args={[radius, 64]} />
          <meshStandardMaterial color="#0a0a0c" metalness={0.35} roughness={0.42} side={DoubleSide} />
        </mesh>
        {/* Grooves: a few concentric rings are enough to read as vinyl. */}
        {[0.94, 0.82, 0.7, 0.58].map((scale) => (
          <mesh key={scale} position={[0, 0, 0.0008]}>
            <ringGeometry args={[radius * scale - 0.004, radius * scale, 64]} />
            <meshBasicMaterial color="#1b1b20" transparent opacity={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.0016]}>
          <circleGeometry args={[radius * 0.36, 48]} />
          <meshStandardMaterial
            key={labelTexture?.uuid ?? 'no-label'}
            map={labelTexture ?? undefined}
            color={labelTexture ? '#ffffff' : '#3a1d5c'}
            roughness={0.8}
          />
        </mesh>
        <mesh position={[0, 0, 0.0024]}>
          <circleGeometry args={[radius * 0.035, 16]} />
          <meshBasicMaterial color="#07050a" />
        </mesh>
      </group>
    </animated.group>
  )
}

export function MediaCase({
  item,
  position,
  selected,
  dragging,
  dimmed,
  onSelect,
  onDragStart,
}: MediaCaseProps) {
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<Group>(null)

  const dims = CASE_DIMENSIONS[item.type]
  const front = useLazyTexture(item.coverImageUrl || undefined)
  const back = useLazyTexture(item.backCoverImageUrl || undefined)
  // Stands in for a sleeve with no scan yet — a film before TMDB is wired up,
  // or anything added by hand. Without it those cases are blank slabs.
  const label = useLabelTexture(
    !item.coverImageUrl,
    item.title,
    item.artistOrDirector,
    dims.width / dims.height,
  )
  const faceTexture = front ?? label
  const glow = item.dominantColor || FALLBACK_GLOW

  // Pointer-down starts a drag, but a click must still select. Distinguished
  // by distance travelled, not by timing, so a slow deliberate click still
  // selects and a fast flick still drags.
  const pressRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null)

  const spring = useSpring({
    z: selected ? 0.9 : hovered ? 0.16 : 0,
    rotationY: selected ? Math.PI : 0,
    scale: selected ? 1.12 : hovered ? 1.05 : 1,
    tilt: hovered && !selected ? -0.16 : 0,
    emissive: selected ? 0.55 : hovered ? 0.32 : 0,
    config: { tension: 210, friction: 24 },
  })

  const materials = useMemo(
    () => ({ body: CASE_BODY[item.type] }),
    [item.type],
  )

  function handlePointerDown(event: { stopPropagation: () => void; nativeEvent: PointerEvent }) {
    event.stopPropagation()
    pressRef.current = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
      dragging: false,
    }
  }

  function handlePointerMove(event: { nativeEvent: PointerEvent }) {
    const press = pressRef.current
    if (!press || press.dragging) return
    const travelled = Math.hypot(
      event.nativeEvent.clientX - press.x,
      event.nativeEvent.clientY - press.y,
    )
    if (travelled > 6) {
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
      ref={groupRef}
      position-x={position[0]}
      position-y={position[1]}
      position-z={spring.z.to((z) => position[2] + z)}
      rotation-x={spring.tilt}
      rotation-y={spring.rotationY}
      scale={spring.scale}
      visible={!dragging}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* The case body. Vinyl is a card sleeve, so it gets no bevel or sheen. */}
      <mesh castShadow>
        <boxGeometry args={[dims.width, dims.height, dims.depth]} />
        <animated.meshStandardMaterial
          color={materials.body}
          emissive={glow}
          emissiveIntensity={spring.emissive}
          roughness={item.type === 'vinyl' ? 0.92 : 0.42}
          metalness={item.type === 'vinyl' ? 0 : 0.15}
          transparent
          opacity={dimmed ? 0.25 : 1}
        />
      </mesh>

      {/* Front artwork, or a printed label when there is no scan */}
      <mesh position={[0, 0, dims.depth / 2 + 0.001]}>
        <planeGeometry args={[dims.width * 0.97, dims.height * 0.97]} />
        <meshStandardMaterial
          key={faceTexture?.uuid ?? 'no-front'}
          map={faceTexture ?? undefined}
          color={faceTexture ? '#ffffff' : '#241a2e'}
          roughness={item.type === 'vinyl' ? 0.88 : 0.55}
          transparent
          opacity={dimmed ? 0.25 : 1}
        />
      </mesh>

      {/* Back artwork, rotated so it reads correctly once the case is turned */}
      <mesh position={[0, 0, -dims.depth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[dims.width * 0.97, dims.height * 0.97]} />
        <meshStandardMaterial
          key={back?.uuid ?? 'no-back'}
          map={back ?? undefined}
          color={back ? '#ffffff' : '#181022'}
          roughness={0.7}
          transparent
          opacity={dimmed ? 0.25 : 1}
        />
      </mesh>

      {item.type === 'vinyl' ? (
        <Record item={item} open={selected} />
      ) : (
        item.type === 'cd' && <Disc item={item} open={selected} />
      )}
    </animated.group>
  )
}
