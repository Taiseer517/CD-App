import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Group } from 'three'

export function useIdleDrift(groupRef: RefObject<Group | null>, isInteractingRef: RefObject<boolean>) {
  useFrame((state) => {
    if (!groupRef.current || isInteractingRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.y = Math.sin(t * 0.15) * 0.04
  })
}
