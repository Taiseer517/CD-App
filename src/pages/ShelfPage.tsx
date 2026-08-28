import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { PageTransition } from '../components/layout/PageTransition'
import { CaseDetailPanel } from '../components/shelf/CaseDetailPanel'
import { SearchBox } from '../components/search/SearchBox'
import type { CollectionItem } from '../data/schema'
import { shelfIdFromParam, UNFILED_SLUG } from '../data/shelfRoutes'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { layoutBookcase, reindexAfterMove } from '../scenes/layout'
import { ShelfScene, type DropTarget } from '../scenes/ShelfScene'
import { useWebglSupport } from '../scenes/hooks/useWebglSupport'
import { useCollectionStore } from '../store/useCollectionStore'
import { useUiStore } from '../store/useUiStore'

function matchesQuery(item: CollectionItem, query: string): boolean {
  const haystack =
    `${item.title} ${item.artistOrDirector} ${item.genre} ${item.label} ${item.tags.join(' ')}`.toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

export function ShelfPage() {
  const { shelfId: param } = useParams<{ shelfId: string }>()
  const shelfId = shelfIdFromParam(param)
  const navigate = useNavigate()

  const items = useCollectionStore((state) => state.items)
  const shelves = useCollectionStore((state) => state.shelves)
  const renameShelf = useCollectionStore((state) => state.renameShelf)
  const deleteShelf = useCollectionStore((state) => state.deleteShelf)
  const savePlacements = useCollectionStore((state) => state.savePlacements)

  const searchQuery = useUiStore((state) => state.searchQuery)
  const cinematicEffects = useUiStore((state) => state.cinematicEffects)
  const setCinematicEffects = useUiStore((state) => state.setCinematicEffects)

  const webglSupported = useWebglSupport()
  const reducedMotion = useReducedMotion()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')

  const shelf = shelves.find((entry) => entry.id === shelfId) ?? null
  const shelfName = shelf?.name ?? 'Unfiled'

  // Only this shelf's records reach the scene, which is what keeps one page
  // to one rack and the 3D to a size the eye can actually take in.
  const onShelf = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.wishlist &&
          (item.shelfId && shelves.some((s) => s.id === item.shelfId) ? item.shelfId : null) ===
            shelfId,
      ),
    [items, shelves, shelfId],
  )

  const searchActive = searchQuery.trim().length > 0
  const shown = useMemo(
    () => (searchActive ? onShelf.filter((item) => matchesQuery(item, searchQuery)) : onShelf),
    [onShelf, searchQuery, searchActive],
  )

  const selected = useMemo(
    () => onShelf.find((item) => item.id === selectedId) ?? null,
    [onShelf, selectedId],
  )

  // Layout for this shelf alone, so a drop is numbered against what is drawn.
  const scenShelves = useMemo(
    () => (shelf ? [{ ...shelf, order: 0 }] : []),
    [shelf],
  )

  async function handleMove(itemId: string, target: DropTarget) {
    const layout = layoutBookcase(onShelf, scenShelves)
    await savePlacements(reindexAfterMove(layout, itemId, shelfId, target.index))
  }

  async function handleTidy() {
    const sorted = [...onShelf].sort(
      (a, b) =>
        a.artistOrDirector.localeCompare(b.artistOrDirector) ||
        a.year - b.year ||
        a.title.localeCompare(b.title),
    )
    await savePlacements(sorted.map((item, position) => ({ id: item.id, shelfId, position })))
  }

  async function handleDeleteShelf() {
    if (!shelf) return
    if (!window.confirm(`Take down the "${shelf.name}" shelf? Its records move to Unfiled.`)) return
    await deleteShelf(shelf.id)
    navigate('/shelf')
  }

  const showCanvas = webglSupported

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/shelf"
              className="text-xs uppercase tracking-[0.2em] text-bone-400 transition-colors hover:text-velvet-300"
            >
              ← The Wall
            </Link>
            {renaming && shelf ? (
              <input
                autoFocus
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={async () => {
                  if (draftName.trim()) await renameShelf(shelf.id, draftName.trim())
                  setRenaming(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setRenaming(false)
                }}
                className="mt-1 block w-full rounded border border-velvet-700 bg-void-950 px-2 py-1 font-display text-2xl text-bone-100 focus:outline-none"
              />
            ) : (
              <h2
                className="mt-1 truncate font-display text-2xl text-bone-100"
                onDoubleClick={() => {
                  if (!shelf) return
                  setDraftName(shelf.name)
                  setRenaming(true)
                }}
                title={shelf ? 'Double-click to rename' : undefined}
              >
                {shelfName}
              </h2>
            )}
            <p className="text-sm text-bone-400">
              {onShelf.length} {onShelf.length === 1 ? 'record' : 'records'}
              {searchActive && ` · showing ${shown.length}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTidy}
              className="rounded-md border border-void-700 px-3 py-1.5 text-sm text-bone-300 transition-colors hover:border-velvet-400 hover:text-bone-100"
            >
              Tidy by artist
            </button>
            {shelf && (
              <button
                type="button"
                onClick={handleDeleteShelf}
                className="rounded-md border border-void-700 px-3 py-1.5 text-sm text-bone-400 transition-colors hover:border-blood-500 hover:text-bone-100"
              >
                Take down
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-bone-400">
              <input
                type="checkbox"
                checked={cinematicEffects}
                onChange={(event) => setCinematicEffects(event.target.checked)}
              />
              Cinematic
            </label>
          </div>
        </div>

        <SearchBox />

        {onShelf.length === 0 ? (
          <EmptyState
            title="Nothing on this shelf yet"
            message={
              shelfId === null
                ? 'Everything has been filed away.'
                : 'Open a record and use “Move to shelf” to put it here.'
            }
          />
        ) : showCanvas ? (
          <div className="relative h-[640px] overflow-hidden rounded-xl border border-void-700 bg-void-950">
            <ShelfScene
              items={shown}
              shelves={scenShelves}
              selectedId={selectedId}
              searchActive={searchActive}
              cinematicEffects={cinematicEffects}
              reducedMotion={reducedMotion}
              onSelect={(item) => setSelectedId((current) => (current === item.id ? null : item.id))}
              onMove={handleMove}
            />
            <CaseDetailPanel item={selected} onClose={() => setSelectedId(null)} />
          </div>
        ) : (
          <EmptyState
            title="This browser can't run the 3D shelf"
            message="No WebGL support was detected — the Collection page shows everything as a grid."
          />
        )}
      </div>
    </PageTransition>
  )
}

export { UNFILED_SLUG }
