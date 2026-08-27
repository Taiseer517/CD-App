import { useMemo } from 'react'
import { useCollectionStore } from '../store/useCollectionStore'
import { useUiStore } from '../store/useUiStore'
import type { CollectionItem } from '../data/schema'

function matches(item: CollectionItem, query: string): boolean {
  if (!query.trim()) return true
  const haystack = `${item.title} ${item.artistOrDirector} ${item.genre} ${item.tags.join(' ')}`.toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

export function useFilterOptions() {
  const items = useCollectionStore((state) => state.items)

  return useMemo(() => {
    const genres = new Set<string>()
    const formats = new Set<string>()
    const years = new Set<number>()
    const tags = new Set<string>()

    for (const item of items) {
      if (item.genre) genres.add(item.genre)
      if (item.format) formats.add(item.format)
      if (item.year) years.add(item.year)
      for (const tag of item.tags) tags.add(tag)
    }

    return {
      genres: [...genres].sort(),
      formats: [...formats].sort(),
      years: [...years].sort((a, b) => b - a),
      tags: [...tags].sort(),
    }
  }, [items])
}

export function useFilteredCollection(options: { includeWishlist?: boolean } = {}) {
  const items = useCollectionStore((state) => state.items)
  const searchQuery = useUiStore((state) => state.searchQuery)
  const filters = useUiStore((state) => state.filters)
  const includeWishlist = options.includeWishlist ?? false

  return useMemo(() => {
    return items.filter((item) => {
      if (item.wishlist !== includeWishlist) return false
      if (filters.genre && item.genre !== filters.genre) return false
      if (filters.format && item.format !== filters.format) return false
      if (filters.year && item.year !== filters.year) return false
      if (filters.tag && !item.tags.includes(filters.tag)) return false
      if (filters.minRating && item.rating < filters.minRating) return false
      if (!matches(item, searchQuery)) return false
      return true
    })
  }, [items, searchQuery, filters, includeWishlist])
}
