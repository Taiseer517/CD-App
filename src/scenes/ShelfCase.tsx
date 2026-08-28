import { Outlines, Text, useTexture } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { Component, Suspense, useState, type ReactNode } from 'react'
import cinzelFontUrl from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff?url'
import type { CollectionItem } from '../data/schema'

export const CASE_WIDTH = 1
export const CASE_HEIGHT = 1.4
const CASE_DEPTH = 0.15

const BASE_COLOR: Record<CollectionItem['type'], string> = {
  cd: '#221b2b',
  dvd: '#1f1130',
  vinyl: '#17121c',
}

const GLOW_COLOR = '#c22f3f'

class TextureErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function PlaceholderLabel({ item }: { item: CollectionItem }) {
  return (
    <group position={[0, 0, CASE_DEPTH / 2 + 0.001]}>
      <mesh>
        <planeGeometry args={[CASE_WIDTH * 0.92, CASE_HEIGHT * 0.92]} />
        <meshStandardMaterial color="#1f1130" roughness={0.85} />
      </mesh>
      <Text
        position={[0, 0, 0.005]}
        font={cinzelFontUrl}
        fontSize={0.13}
        maxWidth={CASE_WIDTH * 0.8}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#b8ad9c"
      >
        {item.title}
      </Text>
    </group>
  )
}

function CoverLabel({ item }: { item: CollectionItem }) {
  const texture = useTexture(item.coverImageUrl)
  return (
    <mesh position={[0, 0, CASE_DEPTH / 2 + 0.001]}>
      <planeGeometry args={[CASE_WIDTH * 0.98, CASE_HEIGHT * 0.98]} />
      <meshStandardMaterial map={texture} roughness={0.7} />
    </mesh>
  )
}

function CaseLabel({ item }: { item: CollectionItem }) {
  if (!item.coverImageUrl) return <PlaceholderLabel item={item} />
  return (
    <TextureErrorBoundary fallback={<PlaceholderLabel item={item} />}>
      <Suspense fallback={<PlaceholderLabel item={item} />}>
        <CoverLabel item={item} />
      </Suspense>
    </TextureErrorBoundary>
  )
}

interface ShelfCaseProps {
  item: CollectionItem
  position: [number, number, number]
  onSelect: (item: CollectionItem) => void
}

export function ShelfCase({ item, position, onSelect }: ShelfCaseProps) {
  const [hovered, setHovered] = useState(false)
  const [springs, api] = useSpring(() => ({
    rotationY: 0,
    scale: 1,
    positionZ: 0,
    emissiveIntensity: 0,
    config: { tension: 300, friction: 22 },
  }))

  function handlePointerOver(event: { stopPropagation: () => void }) {
    event.stopPropagation()
    setHovered(true)
    api.start({ rotationY: 0.35, scale: 1.08, positionZ: 0.15, emissiveIntensity: 0.7 })
  }

  function handlePointerOut(event: { stopPropagation: () => void }) {
    event.stopPropagation()
    setHovered(false)
    api.start({ rotationY: 0, scale: 1, positionZ: 0, emissiveIntensity: 0 })
  }

  function handleClick(event: { stopPropagation: () => void }) {
    event.stopPropagation()
    api.start({
      rotationY: Math.PI * 0.18,
      scale: 1.35,
      positionZ: 1.4,
      emissiveIntensity: 1,
      config: { tension: 220, friction: 20 },
    })
    window.setTimeout(() => onSelect(item), 260)
  }

  return (
    <group position={position}>
      <animated.group
        position-z={springs.positionZ}
        rotation-y={springs.rotationY}
        scale={springs.scale}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <mesh>
          <boxGeometry args={[CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH]} />
          <animated.meshStandardMaterial
            color={BASE_COLOR[item.type]}
            emissive={GLOW_COLOR}
            emissiveIntensity={springs.emissiveIntensity}
            roughness={0.6}
            metalness={0.1}
          />
          {hovered && <Outlines thickness={0.03} color={GLOW_COLOR} />}
        </mesh>
        <Suspense fallback={null}>
          <CaseLabel item={item} />
        </Suspense>
      </animated.group>
    </group>
  )
}
