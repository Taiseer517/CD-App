import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plane, Raycaster, Vector2, Vector3, type Group, type PerspectiveCamera } from 'three'
import type { CollectionItem, Shelf } from '../data/schema'
import { deriveAmbience } from './ambience'
import { Bookcase } from './Bookcase'
import { CASE_DIMENSIONS, PLANK_DEPTH } from './dimensions'
import { layoutBookcase, rowAt, slotIndexAt, type BookcaseLayout } from './layout'
import { useLazyTexture } from './hooks/useLazyTexture'

export interface DropTarget {
  shelfId: string | null
  index: number
}

interface ShelfSceneProps {
  items: CollectionItem[]
  shelves: Shelf[]
  selectedId: string | null
  matchedIds: Set<string>
  searchActive: boolean
  cinematicEffects: boolean
  reducedMotion: boolean
  onSelect: (item: CollectionItem) => void
  onMove: (itemId: string, target: DropTarget) => void
}

/** The case that follows the pointer while a drag is in flight. */
function DragGhost({ item, position }: { item: CollectionItem; position: Vector3 }) {
  const dims = CASE_DIMENSIONS[item.type]
  const texture = useLazyTexture(item.coverImageUrl || undefined)

  return (
    <group position={position} rotation={[0, 0, -0.08]} scale={1.1}>
      <mesh>
        <boxGeometry args={[dims.width, dims.height, dims.depth]} />
        <meshStandardMaterial
          color="#1a1422"
          emissive={item.dominantColor || '#c22f3f'}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[0, 0, dims.depth / 2 + 0.001]}>
        <planeGeometry args={[dims.width * 0.97, dims.height * 0.97]} />
        <meshStandardMaterial
          key={texture?.uuid ?? 'no-ghost'}
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#241a2e'}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  )
}

/**
 * Tracks the pointer during a drag and reports where the case would land.
 *
 * Drop position is read by intersecting the pointer ray with the plane the
 * cases sit on, so the case follows the cursor at shelf depth rather than
 * drifting nearer or further as the camera angle changes.
 */
function DragLayer({
  item,
  layout,
  onHover,
  onDrop,
  onCancel,
}: {
  item: CollectionItem
  layout: BookcaseLayout
  onHover: (target: DropTarget | null) => void
  onDrop: (target: DropTarget | null) => void
  onCancel: () => void
}) {
  const { camera, gl } = useThree()
  const [position, setPosition] = useState(() => new Vector3())
  const targetRef = useRef<DropTarget | null>(null)

  useEffect(() => {
    const element = gl.domElement
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const plane = new Plane(new Vector3(0, 0, 1), -(PLANK_DEPTH / 2 - 0.35))
    const hit = new Vector3()

    function locate(event: PointerEvent): Vector3 | null {
      const rect = element.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      return raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : null
    }

    function handleMove(event: PointerEvent) {
      const point = locate(event)
      if (!point) return
      setPosition(point)

      const row = rowAt(layout, point.y)
      const next = row ? { shelfId: row.shelfId, index: slotIndexAt(row, point.x) } : null
      targetRef.current = next
      onHover(next)
    }

    function handleUp() {
      onDrop(targetRef.current)
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }

    element.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('keydown', handleKey)
    return () => {
      element.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('keydown', handleKey)
    }
  }, [camera, gl, layout, onHover, onDrop, onCancel])

  return <DragGhost item={item} position={position} />
}

/**
 * Pulls the camera back far enough to hold the whole bookcase, re-fitting when
 * a new shelf changes its height. Only runs when the bookcase's size actually
 * changes, so it never fights the user's own zooming.
 */
function FitCamera({ layout }: { layout: BookcaseLayout }) {
  const { camera, size } = useThree()
  const fittedRef = useRef('')

  useEffect(() => {
    const signature = `${layout.height.toFixed(2)}x${layout.width}x${size.width}x${size.height}`
    if (fittedRef.current === signature) return
    fittedRef.current = signature

    const perspective = camera as PerspectiveCamera
    const vFov = (perspective.fov * Math.PI) / 180
    const aspect = size.width / Math.max(size.height, 1)

    const forHeight = layout.height / 2 / Math.tan(vFov / 2)
    const forWidth = layout.width / 2 / (Math.tan(vFov / 2) * aspect)

    // 1.25 leaves the case breathing room inside the frame instead of letting
    // the outermost sleeves touch the edges.
    perspective.position.set(0, 0, Math.max(forHeight, forWidth) * 1.25 + 1)
    perspective.updateProjectionMatrix()
  }, [camera, layout.height, layout.width, size.width, size.height])

  return null
}

function IdleDrift({ speed, enabled }: { speed: number; enabled: boolean }) {
  const ref = useRef<Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    if (!enabled) {
      ref.current.rotation.y = 0
      return
    }
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * speed) * 0.035
  })
  return <group ref={ref} />
}

function SceneContents({
  items,
  shelves,
  selectedId,
  matchedIds,
  searchActive,
  reducedMotion,
  onSelect,
  onMove,
}: Omit<ShelfSceneProps, 'cinematicEffects'>) {
  const layout = useMemo(() => layoutBookcase(items, shelves), [items, shelves])
  const ambience = useMemo(() => deriveAmbience(items), [items])

  const [dragging, setDragging] = useState<CollectionItem | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const groupRef = useRef<Group>(null)

  // The bookcase hangs down from y=0, so shift it up to sit around the origin.
  const centreY = layout.height / 2

  useFrame((state) => {
    if (!groupRef.current || reducedMotion || dragging) return
    groupRef.current.rotation.y =
      Math.sin(state.clock.elapsedTime * ambience.driftSpeed) * 0.03
  })

  function handleDragStart(item: CollectionItem) {
    setDragging(item)
    setDropTarget(null)
  }

  function handleDrop(target: DropTarget | null) {
    if (dragging && target) onMove(dragging.id, target)
    setDragging(null)
    setDropTarget(null)
  }

  return (
    <>
      <color attach="background" args={['#08060a']} />
      <fog attach="fog" args={['#08060a', ambience.fogNear, ambience.fogFar]} />

      {/* The room is meant to be dark, but the artwork is the point of it —
          the covers have to read clearly before the mood does. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={[ambience.keyColor, '#100b16', 0.5]} />

      {/* Key light, warm, high and forward like a candle sconce */}
      <pointLight
        position={[1.8, 1.6, 5.0]}
        intensity={ambience.keyIntensity}
        color={ambience.keyColor}
        distance={26}
        decay={1.6}
      />
      {/* Cold rim from the left, to keep the uprights off flat black */}
      <pointLight
        position={[-5.0, -0.8, 3.2]}
        intensity={22}
        color={ambience.rimColor}
        distance={18}
        decay={1.7}
      />
      {/* Flat frontal fill so sleeves at the edges are not lost to falloff */}
      <directionalLight position={[0, 1.5, 6]} intensity={0.8} color="#e8d9c8" />
      <IdleDrift speed={ambience.driftSpeed} enabled={!reducedMotion} />
      <FitCamera layout={layout} />

      <group ref={groupRef} position={[0, centreY, 0]}>
        <Bookcase
          layout={layout}
          selectedId={selectedId}
          draggingId={dragging?.id ?? null}
          searchActive={searchActive}
          matchedIds={matchedIds}
          onSelect={onSelect}
          onDragStart={handleDragStart}
          dropTarget={dropTarget}
        />

        {dragging && (
          <DragLayer
            item={dragging}
            layout={layout}
            onHover={setDropTarget}
            onDrop={handleDrop}
            onCancel={() => {
              setDragging(null)
              setDropTarget(null)
            }}
          />
        )}
      </group>

      <OrbitControls
        makeDefault
        enabled={!dragging}
        enablePan
        screenSpacePanning
        target={[0, 0, 0]}
        minPolarAngle={Math.PI / 2 - 0.45}
        maxPolarAngle={Math.PI / 2 + 0.3}
        minAzimuthAngle={-0.6}
        maxAzimuthAngle={0.6}
        minDistance={3}
        maxDistance={16}
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.7}
      />
    </>
  )
}

/**
 * A lost WebGL context leaves a blank canvas behind with nothing in the
 * console to explain it. Drivers reset, laptops switch GPUs, and software
 * renderers simply run out — so say what happened and offer the way back.
 */
function ContextLossGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      // Preventing the default is what allows a restore to be attempted.
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onLost])

  return null
}

export function ShelfScene({ cinematicEffects, ...contentProps }: ShelfSceneProps) {
  const [contextLost, setContextLost] = useState(false)

  if (contextLost) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-display text-lg text-bone-100">The shelf lost its graphics context</p>
        <p className="max-w-sm text-sm text-bone-400">
          This usually means the graphics driver restarted. Nothing in your collection was
          affected.
        </p>
        <button
          type="button"
          onClick={() => setContextLost(false)}
          className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400"
        >
          Rebuild the shelf
        </button>
      </div>
    )
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 48 }}
      dpr={[1, 1.5]}
      shadows={false}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <ContextLossGuard onLost={() => setContextLost(true)} />
      <SceneContents {...contentProps} />
      {cinematicEffects && (
        <EffectComposer>
          <Bloom intensity={0.42} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.24} darkness={0.82} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
