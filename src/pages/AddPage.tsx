import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '../components/layout/PageTransition'
import { AddRecord } from '../components/lookup/AddRecord'
import { useCollectionStore } from '../store/useCollectionStore'

/**
 * The front door for putting something in the archive.
 *
 * Adding used to live inside Admin, next to storage settings and a table of
 * everything — which is a filing cabinet, not a way in. Cataloguing is the
 * thing she will do most, so it gets its own page and its own place in the
 * navigation.
 */
export function AddPage() {
  const addItem = useCollectionStore((state) => state.addItem)
  const [destination, setDestination] = useState<'collection' | 'wishlist'>('collection')

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-bone-100">Add a record</h2>
            <p className="text-sm text-bone-400">
              Search for it, check the pressing, and put it away.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-md border border-void-700">
              {(['collection', 'wishlist'] as const).map((where) => (
                <button
                  key={where}
                  type="button"
                  onClick={() => setDestination(where)}
                  aria-pressed={destination === where}
                  className={`px-4 py-2 text-sm capitalize transition-colors ${
                    destination === where
                      ? 'bg-velvet-900/50 text-bone-100'
                      : 'text-bone-400 hover:text-bone-200'
                  }`}
                >
                  {where === 'collection' ? 'I own it' : 'I want it'}
                </button>
              ))}
            </div>
            <Link
              to="/admin/new"
              className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-300 transition-colors hover:border-velvet-400"
            >
              Enter it by hand
            </Link>
          </div>
        </div>

        <AddRecord
          key={destination}
          destination={destination}
          onAdd={async (input) => {
            await addItem({ ...input, wishlist: destination === 'wishlist' })
          }}
        />
      </div>
    </PageTransition>
  )
}
