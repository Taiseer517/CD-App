import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Group,
  type PerspectiveCamera,
  type Points,
} from 'three'
import type { CollectionItem, Shelf } from '../data/schema'
import { deriveAmbience } from './ambience'
import type { ShelfTheme } from './themes'
import { Bookcase } from './Bookcase'
import { PLANK_DEPTH } from './dimensions'
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
  searchActive: boolean
  /** Set to scroll the view to a shelf; undefined leaves the view alone. */
  focusShelfId?: string | null
  cinematicEffects: boolean
  reducedMotion: boolean
  theme: ShelfTheme
  onSelect: (item: CollectionItem) => void
  onMove: (itemId: string, target: DropTarget) => void
}

/**
 * How much of the bookcase is visible at once, in world units. Generous
 * enough that a few shelves are shown whole; a taller case scrolls.
 */
const VIEW_HEIGHT = 7
const CAMERA_DISTANCE = 6.4

/** Dust hanging in the candlelight. */
function Motes({ count = 90, spread }: { count?: number; spread: { x: number; y: number } }) {
  const pointsRef = useRef<Points>(null)

  const geometry = useMemo(() => {
    // A small deterministic generator, so the dust is scattered but stable —
    // Math.random during render gives a different pattern on every pass.
    let seed = 0x2f6e2b1
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (next() - 0.5) * spread.x
      positions[i * 3 + 1] = (next() - 0.5) * spread.y
      positions[i * 3 + 2] = next() * 1.9 + 0.3
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    return geo
  }, [count, spread.x, spread.y])

  useFrame((state) => {
    if (!pointsRef.current) return
    // Drifting rather than falling: dust in still air, not snow.
    pointsRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.09
    pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.11) * 0.09
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.014}
        color="#ffd7a8"
        transparent
        opacity={0.34}
        sizeAttenuation
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/**
 * A fixed camera looking straight at the bookcase.
 *
 * There is no orbiting and no zoom: the shelf is a piece of furniture against
 * a wall, and letting the viewer fly around it made the thing harder to read
 * and harder to drag onto. All that moves is the height, and only when the
 * bookcase is taller than the view.
 */
function StaticCamera({
  layout,
  scrollY,
  reducedMotion,
}: {
  layout: BookcaseLayout
  scrollY: number
  reducedMotion: boolean
}) {
  const { camera, size } = useThree()
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const perspective = camera as PerspectiveCamera
    const vFov = (perspective.fov * Math.PI) / 180
    const aspect = size.width / Math.max(size.height, 1)

    // Frame the whole piece of furniture, crown and plinth included, or a
    // fixed slice of a bookcase too tall to show at once.
    const drawnHeight = layout.extentTop - layout.extentBottom
    const forWidth = (layout.width + 1.5) / 2 / (Math.tan(vFov / 2) * aspect)
    const forHeight = Math.min(drawnHeight, VIEW_HEIGHT) / 2 / Math.tan(vFov / 2)
    perspective.position.z = Math.max(forWidth, forHeight * 1.08, CAMERA_DISTANCE)
    perspective.updateProjectionMatrix()
  }, [camera, layout.width, layout.extentTop, layout.extentBottom, size.width, size.height])

  useEffect(() => {
    function track(event: PointerEvent) {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', track)
    return () => window.removeEventListener('pointermove', track)
  }, [])

  useFrame(() => {
    // A whisper of parallax keeps the scene from feeling like a photograph,
    // without ever becoming a control the viewer has to operate.
    const driftX = reducedMotion ? 0 : pointer.current.x * 0.24
    const driftY = reducedMotion ? 0 : -pointer.current.y * 0.14

    camera.position.x = MathUtils.lerp(camera.position.x, driftX, 0.045)
    camera.position.y = MathUtils.lerp(camera.position.y, scrollY + driftY, 0.12)
    camera.lookAt(0, camera.position.y - driftY * 0.5, 0)
  })

  return null
}

/**
 * Publishes where each visible case has landed on screen, for the browser
 * verification script — clicking a 3D object from outside the canvas is
 * otherwise a matter of guessing coordinates, which silently starts hitting
 * empty shelf whenever the layout changes.
 *
 * Development only; the whole component is dropped from a production build.
 */
function TestProbe({ layout, band }: { layout: BookcaseLayout; band: { min: number; max: number } }) {
  const { camera, gl, size } = useThree()
  const centreY = -(layout.extentTop + layout.extentBottom) / 2

  useFrame(() => {
    const rect = gl.domElement.getBoundingClientRect()
    const projected: { id: string; title: string; x: number; y: number }[] = []
    const point = new Vector3()

    for (const row of layout.rows) {
      if (row.y - row.height / 2 > band.max || row.y + row.height / 2 < band.min) continue
      for (const placed of row.cases) {
        point.set(placed.x, placed.y + centreY, 0)
        point.project(camera)
        projected.push({
          id: placed.item.id,
          title: placed.item.title,
          x: rect.left + ((point.x + 1) / 2) * size.width,
          y: rect.top + ((1 - point.y) / 2) * size.height,
        })
      }
    }

    ;(window as unknown as { __archiveCases?: unknown }).__archiveCases = projected
  })

  return null
}

function DragGhost({ item, position, size }: { item: CollectionItem; position: Vector3; size: { w: number; h: number } }) {
  const texture = useLazyTexture(item.coverImageUrl || undefined)

  return (
    <group position={position} rotation={[0, 0, -0.07]} scale={1.12}>
      <mesh>
        <boxGeometry args={[size.w, size.h, 0.05]} />
        <meshStandardMaterial
          color="#1c1526"
          emissive={item.dominantColor || '#c22f3f'}
          emissiveIntensity={0.6}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[size.w * 0.97, size.h * 0.97]} />
        <meshStandardMaterial
          key={texture?.uuid ?? 'no-ghost'}
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#241a2e'}
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
  )
}

function DragLayer({
  item,
  size,
  layout,
  onHover,
  onDrop,
  onCancel,
}: {
  item: CollectionItem
  size: { w: number; h: number }
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
    const plane = new Plane(new Vector3(0, 0, 1), -(PLANK_DEPTH / 2 - 0.2))
    const hit = new Vector3()

    function handleMove(event: PointerEvent) {
      const rect = element.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return

      setPosition(hit.clone())
      const row = rowAt(layout, hit.y)
      const next = row ? { shelfId: row.shelfId, index: slotIndexAt(row, hit.x) } : null
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

  return <DragGhost item={item} position={position} size={size} />
}

function SceneContents({
  items,
  shelves,
  selectedId,
  searchActive,
  reducedMotion,
  theme,
  scrollY,
  onSelect,
  onMove,
  onLayout,
}: Omit<ShelfSceneProps, 'cinematicEffects' | 'focusShelfId'> & {
  scrollY: number
  onLayout: (layout: BookcaseLayout) => void
}) {
  const layout = useMemo(() => layoutBookcase(items, shelves), [items, shelves])
  const ambience = useMemo(() => {
    const mood = deriveAmbience(items)
    return {
      ...mood,
      keyColor: theme.keyColor,
      rimColor: theme.rimColor,
      keyIntensity: theme.keyIntensity,
      // The theme sets the room; the genre still shifts how close the air
      // feels inside it, so a doom shelf stays heavier than a gothic-rock one.
      fogNear: (mood.fogNear / 18) * theme.fogNear,
      fogFar: (mood.fogFar / 44) * theme.fogFar,
    }
  }, [items, theme])
  const groupRef = useRef<Group>(null)

  const [dragging, setDragging] = useState<{ item: CollectionItem; w: number; h: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  // Reporting the layout upward must not itself cause a re-render that
  // produces a new layout object, or the two chase each other forever.
  useEffect(() => {
    onLayout(layout)
  }, [layout, onLayout])

  // Shift the bookcase so its full drawn extent straddles the origin, which
  // is what the camera frames against.
  const centreY = -(layout.extentTop + layout.extentBottom) / 2

  // One extra row's worth of margin either side, so a row is already built by
  // the time it scrolls into view rather than popping in.
  const band = useMemo(() => {
    const half = VIEW_HEIGHT / 2 + 1.6
    return { min: scrollY - centreY - half, max: scrollY - centreY + half }
  }, [scrollY, centreY])

  function handleDragStart(item: CollectionItem) {
    // A filtered shelf shows only part of itself, so a drop slot computed
    // against it would renumber records it cannot see.
    if (searchActive) return
    const placed = layout.rows.flatMap((row) => row.cases).find((entry) => entry.item.id === item.id)
    setDragging({ item, w: placed?.width ?? 0.6, h: placed?.height ?? 0.8 })
    setDropTarget(null)
  }

  function handleDrop(target: DropTarget | null) {
    if (dragging && target) onMove(dragging.item.id, target)
    setDragging(null)
    setDropTarget(null)
  }

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.background, ambience.fogNear, ambience.fogFar]} />

      {/* Dark is the mood, but the artwork is the point — the sleeves have to
          read clearly first and be atmospheric second. */}
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight args={[ambience.keyColor, theme.woodDark, 0.75]} />
      <pointLight
        position={[2.6, centreY + 1.1, 5.4]}
        intensity={ambience.keyIntensity}
        color={ambience.keyColor}
        distance={30}
        decay={1.5}
      />
      <pointLight
        position={[-4.8, centreY - 1.2, 3.8]}
        intensity={26}
        color={ambience.rimColor}
        distance={20}
        decay={1.6}
      />
      {/* Flat frontal fill, so a sleeve at the far end of a packed row is not
          lost to falloff. */}
      <directionalLight position={[0, 2, 6]} intensity={1.15} color="#f0e2cf" />
      <directionalLight position={[-3, -1, 5]} intensity={0.4} color="#b79ad6" />

      <group ref={groupRef} position={[0, centreY, 0]}>
        <Bookcase
          layout={layout}
          band={band}
          theme={theme}
          selectedId={selectedId}
          draggingId={dragging?.item.id ?? null}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onDragStart={handleDragStart}
          dropTarget={dropTarget}
        />

        {!reducedMotion && (
          <Motes spread={{ x: layout.width + 1, y: Math.max(layout.height, 3) }} />
        )}

        {dragging && (
          <DragLayer
            item={dragging.item}
            size={{ w: dragging.w, h: dragging.h }}
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

      <StaticCamera layout={layout} scrollY={scrollY} reducedMotion={reducedMotion} />
      {import.meta.env.DEV && <TestProbe layout={layout} band={band} />}
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
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onLost])

  return null
}

export function ShelfScene({ cinematicEffects, focusShelfId, ...contentProps }: ShelfSceneProps) {
  const [contextLost, setContextLost] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [bounds, setBounds] = useState({ min: 0, max: 0 })
  const [layout, setLayout] = useState<BookcaseLayout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleLayout = useCallback((layout: BookcaseLayout) => {
    setLayout(layout)
    const drawnHeight = layout.extentTop - layout.extentBottom
    const travel = Math.max(0, (drawnHeight - VIEW_HEIGHT) / 2)

    // Bail out when nothing actually moved. Setting a fresh object every time
    // gives React a new value to diff against, which re-renders the scene,
    // which reports its layout again — an update loop that pins the main
    // thread and never settles.
    setBounds((current) =>
      current.min === -travel && current.max === travel
        ? current
        : { min: -travel, max: travel },
    )
    setScrollY((current) => MathUtils.clamp(current, -travel, travel))
  }, [])

  // Jumping to a shelf from the sidebar, which is the only practical way to
  // navigate a bookcase two dozen rows tall.
  useEffect(() => {
    if (focusShelfId === undefined || !layout) return
    const row = layout.rows.find((candidate) => candidate.shelfId === focusShelfId)
    if (!row) return

    const centreY = -(layout.extentTop + layout.extentBottom) / 2
    setScrollY(MathUtils.clamp(centreY + row.y, bounds.min, bounds.max))
  }, [focusShelfId, layout, bounds])

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return

    function handleWheel(event: WheelEvent) {
      if (bounds.max === 0) return
      // Only intercept the page's scroll when there is somewhere to go, so a
      // short bookcase never traps the wheel.
      event.preventDefault()
      setScrollY((current) =>
        MathUtils.clamp(current - event.deltaY * 0.0022, bounds.min, bounds.max),
      )
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [bounds])

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
    <div ref={wrapperRef} className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ContextLossGuard onLost={() => setContextLost(true)} />
        <SceneContents {...contentProps} scrollY={scrollY} onLayout={handleLayout} />
        {cinematicEffects && (
          <EffectComposer>
            <Bloom intensity={0.55} luminanceThreshold={0.62} luminanceSmoothing={0.32} mipmapBlur />
            <Vignette eskil={false} offset={0.22} darkness={0.86} />
          </EffectComposer>
        )}
      </Canvas>

      {bounds.max > 0 && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-void-950/70 px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-bone-400/80 backdrop-blur-sm">
          Scroll to move up and down the shelves
        </p>
      )}
    </div>
  )
}
