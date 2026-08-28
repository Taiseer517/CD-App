import { useState } from 'react'
import { CollectionCard } from '../components/cards/CollectionCard'
import { EmptyState } from '../components/common/EmptyState'
import { PageTransition } from '../components/layout/PageTransition'
import { AlbumSearch } from '../components/lookup/AlbumSearch'
import { useFilteredCollection } from '../hooks/useCollectionFilters'
import { useCollectionStore } from '../store/useCollectionStore'

export function WishlistPage() {
  const items = useFilteredCollection({ includeWishlist: true })
  const addItem = useCollectionStore((state) => state.addItem)
  const updateItem = useCollectionStore((state) => state.updateItem)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  return (
    <PageTransition>
      <div className="space-y-6">
        <p className="text-sm text-bone-400">
          Records not yet in your hands — ghosts on the shelf, waiting to be claimed.
        </p>

        <AlbumSearch
          actionLabel="Add to wishlist"
          placeholder="Search for a record or film you want…"
          onAdd={async (input) => {
            const created = await addItem({ ...input, wishlist: true })
            setJustAdded(created.title)
          }}
        />

        {justAdded && (
          <p className="text-sm text-velvet-300">Added “{justAdded}” to the wishlist.</p>
        )}

        {items.length === 0 ? (
          <EmptyState
            title="The wishlist is empty"
            message="Search above for something you're hunting for."
          />
        ) : (
          <>
            <h2 className="font-display text-lg text-bone-100">
              {items.length} on the list
            </h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className="space-y-2">
                  <CollectionCard item={item} dimmed />
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { wishlist: false })}
                    className="w-full rounded-md border border-void-700 px-3 py-1.5 text-xs text-bone-300 transition-colors hover:border-blood-500 hover:text-bone-100"
                  >
                    I own this now
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  )
}
