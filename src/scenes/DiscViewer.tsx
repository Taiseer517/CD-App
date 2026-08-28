import { animated, useSpring } from '@react-spring/three'
import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DoubleSide, MathUtils, type Group } from 'three'
import { archiveAudio } from '../audio/archiveAudio'
import type { CollectionItem } from '../data/schema'
import { useDiscFace } from './hooks/useDiscFace'

/**
 * The disc itself, held up to the light.
 *
 * The shelf keeps a fixed camera on purpose — it is furniture against a wall.
 * This is the opposite case: an object in your hands, so it turns freely.
 */

interface DiscViewerProps {
  item: CollectionItem
  onClose: () => void
  reducedMotion: boolean
}

/** 33⅓rpm is 3.49 rad/s; a touch slower so the label stays readable. */
const SPIN_SPEED = 2.2
const FRICTION = 0.985

/**
 * A compact disc, printed edge to edge.
 *
 * A scan of the disc itself is used when the Cover Art Archive has one;
 * otherwise the sleeve is printed across the face, which is what a picture
 * disc does. Either way the artwork covers the whole surface rather than
 * sitting as a token circle in the middle.
 */
function CompactDisc({ item }: { item: CollectionItem }) {
  const face = useDiscFace(item.discImageUrl || item.coverImageUrl || undefined, 'cd')
  const R = 1.25

  return (
    <group>
      <mesh>
        <circleGeometry args={[R, 160]} />
        <meshPhysicalMaterial
          key={face?.uuid ?? 'no-face'}
          map={face ?? undefined}
          color="#ffffff"
          transparent
          metalness={0.4}
          roughness={0.22}
          clearcoat={0.85}
          clearcoatRoughness={0.12}
          iridescence={0.45}
          iridescenceIOR={1.7}
          iridescenceThicknessRange={[180, 820]}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

function VinylRecord({ item }: { item: CollectionItem }) {
  const face = useDiscFace(item.discImageUrl || item.coverImageUrl || undefined, 'vinyl')
  const R = 1.45

  return (
    <group>
      <mesh>
        <circleGeometry args={[R, 160]} />
        <meshPhysicalMaterial
          key={face?.uuid ?? 'no-face'}
          map={face ?? undefined}
          color="#ffffff"
          transparent
          roughness={0.44}
          metalness={0.15}
          clearcoat={0.45}
          clearcoatRoughness={0.4}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Turntable({
  item,
  spinning,
  flipped,
  reducedMotion,
  dragRef,
}: {
  item: CollectionItem
  spinning: boolean
  flipped: boolean
  reducedMotion: boolean
  dragRef: React.RefObject<{ velocity: number; dragging: boolean }>
}) {
  const spinRef = useRef<Group>(null)

  const spring = useSpring({
    flip: flipped ? Math.PI : 0,
    config: { tension: 120, friction: 26 },
  })

  useFrame((_, delta) => {
    if (!spinRef.current) return
    const drag = dragRef.current
    if (!drag) return

    if (drag.dragging) return

    // A flick keeps going and slows, the way a record does on a dead platter.
    if (Math.abs(drag.velocity) > 0.001) {
      spinRef.current.rotation.z += drag.velocity
      drag.velocity *= FRICTION
    } else if (spinning && !reducedMotion) {
      spinRef.current.rotation.z += delta * SPIN_SPEED
    }
  })

  return (
    <animated.group rotation-y={spring.flip}>
      <group ref={spinRef}>
        {item.type === 'vinyl' ? <VinylRecord item={item} /> : <CompactDisc item={item} />}
      </group>
    </animated.group>
  )
}

/** Turns pointer drags into rotation, with a flick that carries. */
function DragToSpin({
  dragRef,
  tiltRef,
}: {
  dragRef: React.RefObject<{ velocity: number; dragging: boolean }>
  tiltRef: React.RefObject<number>
}) {
  const { gl, camera } = useThree()
  const spinTarget = useRef<Group | null>(null)

  useEffect(() => {
    const element = gl.domElement
    let last = { x: 0, y: 0 }

    function down(event: PointerEvent) {
      if (!dragRef.current) return
      dragRef.current.dragging = true
      dragRef.current.velocity = 0
      last = { x: event.clientX, y: event.clientY }
      element.setPointerCapture(event.pointerId)
    }

    function move(event: PointerEvent) {
      if (!dragRef.current?.dragging) return
      const dx = event.clientX - last.x
      const dy = event.clientY - last.y
      last = { x: event.clientX, y: event.clientY }

      // Horizontal drag spins the disc; vertical tips it away from you, so
      // both gestures are available without a mode to switch between.
      dragRef.current.velocity = dx * 0.0012
      if (spinTarget.current) spinTarget.current.rotation.z += dx * 0.006
      if (tiltRef.current !== null) {
        tiltRef.current = MathUtils.clamp(tiltRef.current + dy * 0.005, -0.9, 0.9)
      }
    }

    function up(event: PointerEvent) {
      if (!dragRef.current) return
      dragRef.current.dragging = false
      element.releasePointerCapture?.(event.pointerId)
    }

    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', up)
    return () => {
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', up)
    }
  }, [gl, camera, dragRef, tiltRef])

  return null
}

function Stage({
  item,
  spinning,
  flipped,
  reducedMotion,
  dragRef,
  tiltRef,
}: {
  item: CollectionItem
  spinning: boolean
  flipped: boolean
  reducedMotion: boolean
  dragRef: React.RefObject<{ velocity: number; dragging: boolean }>
  tiltRef: React.RefObject<number>
}) {
  const tiltGroup = useRef<Group>(null)

  useFrame(() => {
    if (tiltGroup.current && tiltRef.current !== null) {
      tiltGroup.current.rotation.x = MathUtils.lerp(
        tiltGroup.current.rotation.x,
        tiltRef.current,
        0.12,
      )
    }
  })

  return (
    <>
      <color attach="background" args={['#07050a']} />

      {/* A mirrored surface shows whatever is around it, and with nothing
          around it shows black — which is exactly how the disc first came
          out. These light panels give it something to reflect, and are what
          make the iridescence sweep as it turns. Built in the scene rather
          than loaded as an HDR, so nothing is fetched and it works offline. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} color="#fff1dd" position={[0, 4, -6]} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={3} color="#a37bd1" position={[-6, 1, -4]} scale={[8, 8, 1]} rotation={[0, Math.PI / 3, 0]} />
        <Lightformer form="rect" intensity={3} color="#7fd4e8" position={[6, -1, -4]} scale={[8, 8, 1]} rotation={[0, -Math.PI / 3, 0]} />
        <Lightformer form="ring" intensity={2.4} color="#ffb37a" position={[0, -5, -3]} scale={7} />
      </Environment>

      <ambientLight intensity={0.85} />
      {/* All the light is off-axis. A source pointed straight down the camera
          axis at a glossy disc puts a blown-out white blob dead centre, which
          is precisely what it did. */}
      <pointLight position={[4.5, 3.2, 3]} intensity={40} color="#ffd9b0" distance={22} decay={1.7} />
      <pointLight position={[-4.5, -2.2, 2.6]} intensity={28} color="#a37bd1" distance={20} decay={1.7} />
      <directionalLight position={[-2, 3, 4]} intensity={0.55} color="#e8eeff" />

      <group ref={tiltGroup}>
        <Turntable
          item={item}
          spinning={spinning}
          flipped={flipped}
          reducedMotion={reducedMotion}
          dragRef={dragRef}
        />
      </group>

      <DragToSpin dragRef={dragRef} tiltRef={tiltRef} />
    </>
  )
}

export function DiscViewer({ item, onClose, reducedMotion }: DiscViewerProps) {
  const [spinning, setSpinning] = useState(!reducedMotion)
  const [flipped, setFlipped] = useState(false)
  const dragRef = useRef({ velocity: 0, dragging: false })
  const tiltRef = useRef(0)

  const reset = useCallback(() => {
    tiltRef.current = 0
    dragRef.current.velocity = 0
    setFlipped(false)
  }, [])

  // The disc coming out of its case, once, on opening.
  useEffect(() => {
    archiveAudio.open()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'f') setFlipped((current) => !current)
      if (event.key === ' ') {
        event.preventDefault()
        setSpinning((current) => !current)
      }
    }
    window.addEventListener('keydown', onKey)
    // The page behind must not scroll while this is over it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const noun = item.type === 'vinyl' ? 'record' : 'disc'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-void-950/97 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} — the ${noun}`}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl text-bone-100">{item.title}</h2>
          <p className="truncate text-sm text-bone-400">
            {item.artistOrDirector}
            {item.year ? ` · ${item.year}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-void-700 px-3 py-1.5 text-sm text-bone-300 transition-colors hover:border-blood-500 hover:text-bone-100"
        >
          Close
        </button>
      </div>

      <div
        className="min-h-0 flex-1 cursor-grab active:cursor-grabbing"
        onDoubleClick={reset}
      >
        <Canvas camera={{ position: [0, 0, 4.2], fov: 42 }} dpr={[1, 1.75]}>
          <Stage
            item={item}
            spinning={spinning}
            flipped={flipped}
            reducedMotion={reducedMotion}
            dragRef={dragRef}
            tiltRef={tiltRef}
          />
        </Canvas>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 px-6 pb-7">
        <button
          type="button"
          onClick={() => setSpinning((current) => !current)}
          className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400"
        >
          {spinning ? 'Stop' : 'Spin'}
        </button>
        <button
          type="button"
          onClick={() => setFlipped((current) => !current)}
          className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400"
        >
          Turn it over
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-300 transition-colors hover:border-velvet-400"
        >
          Reset
        </button>
        <p className="w-full text-center text-xs text-bone-400/80">
          Drag to turn it · flick to keep it spinning · double-click to reset · Esc to close
        </p>
      </div>
    </div>
  )
}
