import type { CollectionItem } from '../data/schema'
import { CASE_HEIGHT, ShelfCase } from './ShelfCase'

const CASE_SPACING = 1.2

interface ShelfSectionProps {
  items: CollectionItem[]
  onSelect: (item: CollectionItem) => void
}

export function ShelfSection({ items, onSelect }: ShelfSectionProps) {
  const totalWidth = Math.max(items.length - 1, 0) * CASE_SPACING
  const plankWidth = Math.max(totalWidth + 1.5, 3)

  return (
    <group>
      <mesh position={[0, -CASE_HEIGHT / 2 - 0.06, 0]}>
        <boxGeometry args={[plankWidth, 0.1, 0.7]} />
        <meshStandardMaterial color="#130f18" roughness={0.9} />
      </mesh>

      {items.map((item, index) => (
        <ShelfCase
          key={item.id}
          item={item}
          position={[index * CASE_SPACING - totalWidth / 2, 0, 0]}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}
