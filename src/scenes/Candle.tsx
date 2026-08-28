import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, type Mesh, type PointLight } from 'three'

interface CandleProps {
  position: [number, number, number]
  height?: number
  /** Offsets the flicker so a row of candles never pulses in unison. */
  seed?: number
  reducedMotion?: boolean
  /**
   * Whether this candle casts a real light. Every dynamic light is compiled
   * into every material's shader, so a tall bookcase full of them costs far
   * more than it looks — past the first few, candles are lit by their
   * neighbours and carry only the flame.
   */
  lit?: boolean
}

const WAX = '#d8cbb4'
const FLAME = '#ffb662'

/**
 * A lit candle: tallow stub, a flame that breathes, and the point light that
 * actually does the work of lighting the shelf beside it.
 *
 * The flicker is two sine waves at unrelated frequencies rather than random
 * noise — noise reads as electrical fault, while beating sines read as a
 * draught moving through a room.
 */
export function Candle({
  position,
  height = 0.3,
  seed = 0,
  reducedMotion = false,
  lit = true,
}: CandleProps) {
  const flameRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const lightRef = useRef<PointLight>(null)

  // Uneven melt, so a row of candles doesn't look machine-made.
  const melt = useMemo(() => 0.82 + ((Math.sin(seed * 12.9898) + 1) / 2) * 0.36, [seed])
  const bodyHeight = height * melt
  const flameY = bodyHeight + 0.055

  useFrame((state) => {
    if (reducedMotion) return
    const t = state.clock.elapsedTime + seed * 3.1
    const flicker = 0.82 + Math.sin(t * 7.3) * 0.1 + Math.sin(t * 2.11) * 0.08

    if (flameRef.current) {
      flameRef.current.scale.set(0.86 + flicker * 0.16, flicker, 0.86 + flicker * 0.16)
      flameRef.current.position.x = Math.sin(t * 3.7) * 0.004
    }
    if (glowRef.current) glowRef.current.scale.setScalar(flicker * 1.1)
    if (lightRef.current) lightRef.current.intensity = 1.5 + flicker * 1.3
  })

  return (
    <group position={position}>
      {/* Tallow stub, wider at the base where the wax has run down */}
      <mesh position={[0, bodyHeight / 2, 0]}>
        <cylinderGeometry args={[0.036, 0.048, bodyHeight, 12]} />
        <meshStandardMaterial color={WAX} roughness={0.72} />
      </mesh>
      {/* Pooled wax around the foot */}
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.07, 0.082, 0.024, 14]} />
        <meshStandardMaterial color="#c9bca4" roughness={0.85} />
      </mesh>
      {/* Wick */}
      <mesh position={[0, bodyHeight + 0.014, 0]}>
        <cylinderGeometry args={[0.003, 0.004, 0.03, 5]} />
        <meshStandardMaterial color="#2b2118" roughness={1} />
      </mesh>

      <mesh ref={flameRef} position={[0, flameY, 0]}>
        <sphereGeometry args={[0.028, 10, 12]} />
        <meshBasicMaterial color={FLAME} transparent opacity={0.95} />
      </mesh>
      {/* Halo, additively blended so it reads as light rather than a ball */}
      <mesh ref={glowRef} position={[0, flameY, 0]}>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
      </mesh>

      {lit && (
        <pointLight
          ref={lightRef}
          position={[0, flameY + 0.02, 0.08]}
          color="#ffa851"
          intensity={2.4}
          distance={3.2}
          decay={1.9}
        />
      )}
    </group>
  )
}
