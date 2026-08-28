import { useCallback, useMemo, useState } from 'react'
import type { CollectionItem } from '../../data/schema'

const SECTION_SIZE = 8

export function useShelfPagination(items: CollectionItem[]) {
  const sections = useMemo(() => {
    const chunks: CollectionItem[][] = []
    for (let i = 0; i < items.length; i += SECTION_SIZE) {
      chunks.push(items.slice(i, i + SECTION_SIZE))
    }
    return chunks.length > 0 ? chunks : [[]]
  }, [items])

  const [sectionIndex, setSectionIndex] = useState(0)
  const clampedIndex = Math.min(sectionIndex, sections.length - 1)

  const goToItem = useCallback(
    (id: string) => {
      const index = sections.findIndex((section) => section.some((item) => item.id === id))
      if (index !== -1) setSectionIndex(index)
    },
    [sections],
  )

  return {
    currentItems: sections[clampedIndex] ?? [],
    sectionIndex: clampedIndex,
    sectionCount: sections.length,
    goNext: () => setSectionIndex((index) => Math.min(index + 1, sections.length - 1)),
    goPrev: () => setSectionIndex((index) => Math.max(index - 1, 0)),
    goToItem,
  }
}
