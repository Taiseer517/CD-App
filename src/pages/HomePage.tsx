import { CollectionCard } from '../components/cards/CollectionCard'
import { EmptyState } from '../components/common/EmptyState'
import { FilterBar } from '../components/filters/FilterBar'
import { PageTransition } from '../components/layout/PageTransition'
import { SearchBox } from '../components/search/SearchBox'
import { useFilteredCollection } from '../hooks/useCollectionFilters'
import { useCollectionStore } from '../store/useCollectionStore'

export function HomePage() {
  const status = useCollectionStore((state) => state.status)
  const items = useFilteredCollection()

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="space-y-4">
          <SearchBox />
          <FilterBar />
        </div>

        {status === 'loading' && <p className="text-bone-400">Loading the collection…</p>}

        {status === 'ready' && items.length === 0 && (
          <EmptyState
            title="Nothing here yet"
            message="Add items through the Admin page, or adjust your filters."
          />
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <CollectionCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
