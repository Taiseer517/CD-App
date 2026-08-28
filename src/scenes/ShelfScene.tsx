import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, DepthOfField, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'
import type { CollectionItem } from '../data/schema'
import { useIdleDrift } from './hooks/useIdleDrift'
import { ShelfSection } from './ShelfSection'

interface ShelfSceneProps {
  items: CollectionItem[]
  onSelect: (item: CollectionItem) => void
  cinematicEffects: boolean
}

function SceneContents({ items, onSelect }: Pick<ShelfSceneProps, 'items' | 'onSelect'>) {
  const shelfGroupRef = useRef<Group>(null)
  const isInteractingRef = useRef(false)
  useIdleDrift(shelfGroupRef, isInteractingRef)

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 3, 4]} intensity={40} color="#ffb37a" distance={14} decay={2} />
      <pointLight position={[-4, 1.5, 2]} intensity={12} color="#7c4fb0" distance={10} decay={2} />
      <fog attach="fog" args={['#08060a', 6, 15]} />

      <group ref={shelfGroupRef}>
        <ShelfSection items={items} onSelect={onSelect} />
      </group>

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 2 - 0.25}
        maxPolarAngle={Math.PI / 2 + 0.12}
        minAzimuthAngle={-0.5}
        maxAzimuthAngle={0.5}
        minDistance={4}
        maxDistance={10}
        enableDamping
        dampingFactor={0.08}
        onStart={() => {
          isInteractingRef.current = true
        }}
        onEnd={() => {
          isInteractingRef.current = false
        }}
      />
    </>
  )
}

export function ShelfScene({ items, onSelect, cinematicEffects }: ShelfSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0.3, 7], fov: 50 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#08060a']} />
      <Suspense fallback={null}>
        <SceneContents items={items} onSelect={onSelect} />
      </Suspense>
      {cinematicEffects && (
        <EffectComposer>
          <DepthOfField focusDistance={0.015} focalLength={0.04} bokehScale={3} />
          <Bloom intensity={0.35} luminanceThreshold={0.4} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  )
}
