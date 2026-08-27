import { CollectionCard } from '../components/cards/CollectionCard'
import { EmptyState } from '../components/common/EmptyState'
import { PageTransition } from '../components/layout/PageTransition'
import { useFilteredCollection } from '../hooks/useCollectionFilters'

export function WishlistPage() {
  const items = useFilteredCollection({ includeWishlist: true })

  return (
    <PageTransition>
      <div className="space-y-6">
        <p className="text-sm text-bone-400">
          Items not yet acquired — ghosts on the shelf, waiting to be claimed.
        </p>

        {items.length === 0 ? (
          <EmptyState
            title="The wishlist is empty"
            message="Add a wishlist item through the Admin page."
          />
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <CollectionCard key={item.id} item={item} dimmed />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
