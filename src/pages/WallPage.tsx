import { useMemo, useState } from 'react'
import { PageTransition } from '../components/layout/PageTransition'
import { ArchClip } from '../components/wall/ArchClip'
import { ShelfAlcove } from '../components/wall/ShelfAlcove'
import { UNFILED_SLUG } from '../data/shelfRoutes'
import type { CollectionItem } from '../data/schema'
import { useCollectionStore } from '../store/useCollectionStore'

export function WallPage() {
  const items = useCollectionStore((state) => state.items)
  const shelves = useCollectionStore((state) => state.shelves)
  const addShelf = useCollectionStore((state) => state.addShelf)
  const [newName, setNewName] = useState('')

  const owned = useMemo(() => items.filter((item) => !item.wishlist), [items])

  const grouped = useMemo(() => {
    const byShelf = new Map<string | null, CollectionItem[]>()
    for (const item of owned) {
      const key = item.shelfId && shelves.some((s) => s.id === item.shelfId) ? item.shelfId : null
      const bucket = byShelf.get(key)
      if (bucket) bucket.push(item)
      else byShelf.set(key, [item])
    }
    // Records with cover art first, so an alcove shows artwork rather than
    // whatever happens to sit in position zero.
    for (const bucket of byShelf.values()) {
      bucket.sort((a, b) => Number(Boolean(b.coverImageUrl)) - Number(Boolean(a.coverImageUrl)))
    }
    return byShelf
  }, [owned, shelves])

  const unfiled = grouped.get(null) ?? []

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    await addShelf({ name, order: shelves.length, accent: '' })
    setNewName('')
  }

  return (
    <PageTransition>
      <ArchClip />

      <div className="stone-wall -mx-6 -mt-10 space-y-10 rounded-b-2xl px-6 pb-12 pt-10 sm:px-10">
        <header className="text-center">
          <h2 className="font-display text-2xl tracking-wide text-bone-100 sm:text-3xl">
            The Wall
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-bone-400">
            Every shelf in the archive. Step into one to handle what is on it.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {[...shelves]
            .sort((a, b) => a.order - b.order)
            .map((shelf, index) => (
              <ShelfAlcove
                key={shelf.id}
                to={`/shelf/${shelf.id}`}
                name={shelf.name}
                count={(grouped.get(shelf.id) ?? []).length}
                items={grouped.get(shelf.id) ?? []}
                index={index}
              />
            ))}

          {unfiled.length > 0 && (
            <ShelfAlcove
              to={`/shelf/${UNFILED_SLUG}`}
              name="Unfiled"
              count={unfiled.length}
              items={unfiled}
              index={shelves.length}
            />
          )}
        </div>

        <form onSubmit={handleCreate} className="mx-auto flex max-w-sm gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Build another shelf…"
            className="min-w-0 flex-1 rounded-md border border-void-700 bg-void-950 px-3 py-2 text-sm text-bone-100 placeholder:text-bone-400/50 focus:border-velvet-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400 disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>
    </PageTransition>
  )
}
