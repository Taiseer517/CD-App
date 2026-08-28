import { useMemo, useState } from 'react'
import { CaseDetailPanel } from '../components/shelf/CaseDetailPanel'
import { ShelfManager } from '../components/shelf/ShelfManager'
import { EmptyState } from '../components/common/EmptyState'
import { PageTransition } from '../components/layout/PageTransition'
import { SearchBox } from '../components/search/SearchBox'
import type { CollectionItem } from '../data/schema'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { reindexAfterMove, layoutBookcase } from '../scenes/layout'
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
  const items = useCollectionStore((state) => state.items)
  const shelves = useCollectionStore((state) => state.shelves)
  const addShelf = useCollectionStore((state) => state.addShelf)
  const renameShelf = useCollectionStore((state) => state.renameShelf)
  const deleteShelf = useCollectionStore((state) => state.deleteShelf)
  const savePlacements = useCollectionStore((state) => state.savePlacements)

  const searchQuery = useUiStore((state) => state.searchQuery)
  const cinematicEffects = useUiStore((state) => state.cinematicEffects)
  const setCinematicEffects = useUiStore((state) => state.setCinematicEffects)
  const viewMode = useUiStore((state) => state.viewMode)
  const setViewMode = useUiStore((state) => state.setViewMode)

  const webglSupported = useWebglSupport()
  const reducedMotion = useReducedMotion()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const owned = useMemo(() => items.filter((item) => !item.wishlist), [items])
  const selected = useMemo(
    () => owned.find((item) => item.id === selectedId) ?? null,
    [owned, selectedId],
  )

  const searchActive = searchQuery.trim().length > 0

  // Among three hundred records, dimming the misses is no help at all — the
  // shelf shows only what matched, and rearranging is paused until the search
  // is cleared so a drag cannot renumber a shelf it can only partly see.
  const shelfItems = useMemo(
    () => (searchActive ? owned.filter((item) => matchesQuery(item, searchQuery)) : owned),
    [owned, searchQuery, searchActive],
  )

  const [focusShelfId, setFocusShelfId] = useState<string | null | undefined>(undefined)

  const counts = useMemo(() => {
    const tally = new Map<string | null, number>()
    for (const item of owned) {
      const key = item.shelfId && shelves.some((s) => s.id === item.shelfId) ? item.shelfId : null
      tally.set(key, (tally.get(key) ?? 0) + 1)
    }
    return tally
  }, [owned, shelves])

  async function handleMove(itemId: string, target: DropTarget) {
    // Recomputed from the full collection rather than the drawn layout, so a
    // move is always numbered against every record on the shelf.
    const layout = layoutBookcase(owned, shelves)
    const changes = reindexAfterMove(layout, itemId, target.shelfId, target.index)
    await savePlacements(changes)
  }

  async function handleTidy(shelfId: string | null) {
    const onShelf = owned
      .filter((item) => (item.shelfId ?? null) === shelfId)
      .sort(
        (a, b) =>
          a.artistOrDirector.localeCompare(b.artistOrDirector) ||
          a.year - b.year ||
          a.title.localeCompare(b.title),
      )
    await savePlacements(
      onShelf.map((item, position) => ({ id: item.id, shelfId, position })),
    )
  }

  const wantsCanvas = viewMode === '3d'
  const showCanvas = wantsCanvas && webglSupported

  if (owned.length === 0) {
    return (
      <PageTransition>
        <EmptyState
          title="The shelf is empty"
          message="Add something you own through the Admin page and it will appear here."
        />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="order-2 space-y-4 lg:order-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-bone-400">
              {!showCanvas
                ? 'Simple mode — the 3D shelf is turned off.'
                : searchActive
                  ? `Showing ${shelfItems.length} ${shelfItems.length === 1 ? 'match' : 'matches'}. Clear the search to rearrange.`
                  : 'Click a case to open it. Drag one to move it between shelves.'}
            </p>
            <div className="flex items-center gap-4">
              {showCanvas && (
                <label className="flex items-center gap-2 text-sm text-bone-400">
                  <input
                    type="checkbox"
                    checked={cinematicEffects}
                    onChange={(event) => setCinematicEffects(event.target.checked)}
                  />
                  Cinematic
                </label>
              )}
              {webglSupported && (
                <label className="flex items-center gap-2 text-sm text-bone-400">
                  <input
                    type="checkbox"
                    checked={wantsCanvas}
                    onChange={(event) => setViewMode(event.target.checked ? '3d' : 'simple')}
                  />
                  3D shelf
                </label>
              )}
            </div>
          </div>

          {showCanvas ? (
            <div className="relative h-[680px] overflow-hidden rounded-xl border border-void-700 bg-void-950">
              <ShelfScene
                items={shelfItems}
                shelves={shelves}
                selectedId={selectedId}
                searchActive={searchActive}
                focusShelfId={focusShelfId}
                cinematicEffects={cinematicEffects}
                reducedMotion={reducedMotion}
                onSelect={(item) => setSelectedId((current) => (current === item.id ? null : item.id))}
                onMove={handleMove}
              />
              <CaseDetailPanel item={selected} onClose={() => setSelectedId(null)} />
            </div>
          ) : (
            <EmptyState
              title={webglSupported ? 'Simple mode is on' : "This browser can't run the 3D shelf"}
              message={
                webglSupported
                  ? 'Turn the 3D shelf back on above, or browse the Collection page instead.'
                  : 'No WebGL support was detected — the Collection page shows everything as a grid.'
              }
            />
          )}
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <SearchBox />
          <ShelfManager
            shelves={shelves}
            counts={counts}
            unfiledCount={counts.get(null) ?? 0}
            onCreate={async (name) => {
              await addShelf({ name, order: shelves.length, accent: '' })
            }}
            onRename={renameShelf}
            onDelete={deleteShelf}
            onTidy={handleTidy}
            onFocus={(id) => setFocusShelfId(id)}
          />
        </div>
      </div>
    </PageTransition>
  )
}
