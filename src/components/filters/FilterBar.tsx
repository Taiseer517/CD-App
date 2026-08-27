import { useFilterOptions } from '../../hooks/useCollectionFilters'
import { useUiStore } from '../../store/useUiStore'

const selectClass =
  'rounded-md border border-void-700 bg-void-900 px-3 py-2 text-sm text-bone-200 focus:border-blood-500 focus:outline-none'

export function FilterBar() {
  const { genres, formats, years, tags } = useFilterOptions()
  const filters = useUiStore((state) => state.filters)
  const setFilter = useUiStore((state) => state.setFilter)
  const resetFilters = useUiStore((state) => state.resetFilters)

  const hasActiveFilters =
    filters.genre || filters.format || filters.year || filters.tag || filters.minRating

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className={selectClass}
        value={filters.genre ?? ''}
        onChange={(event) => setFilter('genre', event.target.value || null)}
      >
        <option value="">All genres</option>
        {genres.map((genre) => (
          <option key={genre} value={genre}>
            {genre}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.format ?? ''}
        onChange={(event) => setFilter('format', event.target.value || null)}
      >
        <option value="">All formats</option>
        {formats.map((format) => (
          <option key={format} value={format}>
            {format}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.year ?? ''}
        onChange={(event) => setFilter('year', event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">All years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.tag ?? ''}
        onChange={(event) => setFilter('tag', event.target.value || null)}
      >
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.minRating ?? ''}
        onChange={(event) =>
          setFilter('minRating', event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">Any rating</option>
        {[5, 4, 3, 2, 1].map((rating) => (
          <option key={rating} value={rating}>
            {rating}+ ★
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="text-sm text-blood-300 underline-offset-4 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
