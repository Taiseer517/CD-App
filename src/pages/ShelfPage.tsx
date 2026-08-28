import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { PageTransition } from '../components/layout/PageTransition'
import type { CollectionItem } from '../data/schema'
import { useFilteredCollection } from '../hooks/useCollectionFilters'
import { ShelfScene } from '../scenes/ShelfScene'
import { useShelfPagination } from '../scenes/hooks/useShelfPagination'
import { useWebglSupport } from '../scenes/hooks/useWebglSupport'
import { useUiStore } from '../store/useUiStore'

export function ShelfPage() {
  const navigate = useNavigate()
  const items = useFilteredCollection()
  const { currentItems, sectionIndex, sectionCount, goNext, goPrev } = useShelfPagination(items)
  const cinematicEffects = useUiStore((state) => state.cinematicEffects)
  const setCinematicEffects = useUiStore((state) => state.setCinematicEffects)
  const viewMode = useUiStore((state) => state.viewMode)
  const setViewMode = useUiStore((state) => state.setViewMode)
  const webglSupported = useWebglSupport()

  const wantsCanvas = viewMode === '3d'
  const showCanvas = wantsCanvas && webglSupported

  function handleSelect(item: CollectionItem) {
    navigate(`/item/${item.id}`)
  }

  if (items.length === 0) {
    return (
      <PageTransition>
        <EmptyState title="The shelf is empty" message="Add owned items through the Admin page first." />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-bone-400">
            {showCanvas
              ? `Shelf ${sectionIndex + 1} of ${sectionCount} — drag to look around, hover a case, click to pull it forward.`
              : 'Simple mode — the 3D shelf is turned off.'}
          </p>
          <div className="flex items-center gap-4">
            {showCanvas && (
              <label className="flex items-center gap-2 text-sm text-bone-400">
                <input
                  type="checkbox"
                  checked={cinematicEffects}
                  onChange={(event) => setCinematicEffects(event.target.checked)}
                />
                Cinematic effects
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
          <div className="relative h-[560px] overflow-hidden rounded-xl border border-void-700">
            <ShelfScene items={currentItems} onSelect={handleSelect} cinematicEffects={cinematicEffects} />

            {sectionCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={sectionIndex === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-void-700 bg-void-950/80 px-3 py-2 text-lg text-bone-200 transition-colors hover:border-blood-500 disabled:opacity-30"
                  aria-label="Previous shelf"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={sectionIndex === sectionCount - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-void-700 bg-void-950/80 px-3 py-2 text-lg text-bone-200 transition-colors hover:border-blood-500 disabled:opacity-30"
                  aria-label="Next shelf"
                >
                  ›
                </button>
              </>
            )}
          </div>
        ) : (
          <EmptyState
            title={webglSupported ? 'Simple mode is on' : "Your browser can't run the 3D shelf"}
            message={
              webglSupported
                ? 'Turn "3D shelf" back on above, or browse the Collection page instead.'
                : 'No WebGL support detected in this browser — browse the Collection page instead.'
            }
          />
        )}
      </div>
    </PageTransition>
  )
}
