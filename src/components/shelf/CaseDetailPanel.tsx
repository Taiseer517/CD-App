import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CollectionItem } from '../../data/schema'
import { archiveAudio } from '../../audio/archiveAudio'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useCollectionStore } from '../../store/useCollectionStore'
import { Rating } from '../common/Rating'

const DiscViewer = lazy(() =>
  import('../../scenes/DiscViewer').then((module) => ({ default: module.DiscViewer })),
)

function duration(ms: number | null): string {
  if (!ms) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

interface CaseDetailPanelProps {
  item: CollectionItem | null
  onClose: () => void
  /** Shown when nothing is selected, so the column is never simply blank. */
  shelfName?: string
  total?: number
}

/**
 * Details live in an HTML panel rather than as 3D text: at shelf distance,
 * rendered type is unreadable, and a tracklist needs to be selectable.
 */
export function CaseDetailPanel({ item, onClose, shelfName, total }: CaseDetailPanelProps) {
  const updateItem = useCollectionStore((state) => state.updateItem)
  const shelves = useCollectionStore((state) => state.shelves)
  const moveItemToShelf = useCollectionStore((state) => state.moveItemToShelf)
  const reducedMotion = useReducedMotion()
  const [viewingDisc, setViewingDisc] = useState(false)

  return (
    <AnimatePresence mode="wait">
      {!item ? (
        <motion.aside
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="rounded-xl border border-void-700 bg-void-900/40 p-6 text-center"
        >
          <p className="font-display text-sm uppercase tracking-[0.18em] text-velvet-300">
            {shelfName ?? 'This shelf'}
          </p>
          <p className="mt-2 text-sm text-bone-400">
            {total === 0
              ? 'Nothing on it yet.'
              : `${total} ${total === 1 ? 'record' : 'records'}. Take one down to look at it.`}
          </p>
        </motion.aside>
      ) : (
        <motion.aside
          key={item.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="flex max-h-[78vh] flex-col overflow-hidden rounded-xl border border-void-700 bg-void-950/92"
          style={
            item.dominantColor
              ? { boxShadow: `inset 0 3px 26px -14px ${item.dominantColor}` }
              : undefined
          }
        >
          <div className="flex items-start justify-between gap-3 border-b border-void-800 p-5">
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl text-bone-100">{item.title}</h3>
              <p className="truncate text-sm text-bone-400">
                {item.artistOrDirector}
                {item.year ? ` · ${item.year}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                archiveAudio.close()
                onClose()
              }}
              aria-label="Close details"
              className="shrink-0 rounded-md border border-void-700 px-2 py-1 text-bone-400 transition-colors hover:border-blood-500 hover:text-bone-100"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-bone-400">Your rating</p>
              <Rating
                value={item.rating}
                onChange={(rating) => updateItem(item.id, { rating })}
              />
            </div>

            {/* Sourced facts, and hers, kept apart. A field the source did
                not supply is simply absent rather than shown empty. */}
            <div>
              <p className="font-display text-[0.62rem] uppercase tracking-[0.18em] text-velvet-300">
                {item.sourceName ? `From ${item.sourceName}` : 'Details'}
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-2 normal-case tracking-normal underline-offset-2 hover:underline"
                  >
                    source
                  </a>
                )}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {(
                  [
                    ['Genre', item.genre],
                    ['Label', item.label],
                    ['Format', item.format],
                    ['Catalogue', item.catalogNumber],
                    ['Pressed in', item.country],
                    ['Barcode', item.barcode],
                    ['Runtime', item.runtimeMinutes ? `${item.runtimeMinutes} min` : ''],
                  ] as [string, string][]
                )
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wide text-bone-400">{label}</dt>
                      <dd className="text-bone-200">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            {item.synopsis && (
              <p className="text-sm leading-relaxed text-bone-300">{item.synopsis}</p>
            )}

            {item.funFact && (
              <div className="border-l-2 border-velvet-700 pl-3">
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-velvet-300">
                  Worth knowing
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-bone-300">
                  {item.funFact}
                </p>
              </div>
            )}

            {(item.conditionOrEdition || item.dateAcquired) && (
              <div>
                <p className="font-display text-[0.62rem] uppercase tracking-[0.18em] text-velvet-300">
                  Zarin&rsquo;s record
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {(
                    [
                      ['Condition', item.conditionOrEdition],
                      ['Acquired', item.dateAcquired],
                    ] as [string, string][]
                  )
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs uppercase tracking-wide text-bone-400">{label}</dt>
                        <dd className="text-bone-200">{value}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            <div>
              <label
                htmlFor="move-to-shelf"
                className="mb-1 block text-xs uppercase tracking-wide text-bone-400"
              >
                Move to shelf
              </label>
              <select
                id="move-to-shelf"
                value={item.shelfId ?? ''}
                onChange={(event) => moveItemToShelf(item.id, event.target.value || null)}
                className="w-full rounded-md border border-void-700 bg-void-950 px-2 py-1.5 text-sm text-bone-100 focus:border-velvet-400 focus:outline-none"
              >
                <option value="">Unfiled</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </div>

            {item.notes && (
              <p className="border-l-2 border-blood-700 pl-3 text-sm italic text-bone-300">
                {item.notes}
              </p>
            )}

            {item.trackList.length > 0 && (
              <div>
                <h4 className="font-display text-xs uppercase tracking-wide text-velvet-300">
                  Tracklist
                </h4>
                <ol className="mt-2 space-y-1 text-sm">
                  {item.trackList.map((track) => (
                    <li
                      key={`${track.position}-${track.title}`}
                      className="flex justify-between gap-3 border-b border-void-800/60 pb-1"
                    >
                      <span className="min-w-0 truncate text-bone-300">
                        <span className="mr-2 text-bone-400 tabular-nums">{track.position}</span>
                        {track.title}
                      </span>
                      <span className="shrink-0 text-bone-400 tabular-nums">
                        {duration(track.lengthMs)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-void-800 p-5">
            {item.type !== 'dvd' && (
              <button
                type="button"
                onClick={() => setViewingDisc(true)}
                className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400"
              >
                See the {item.type === 'vinyl' ? 'record' : 'disc'}
              </button>
            )}
            <Link
              to={`/item/${item.id}`}
              className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
            >
              Full page
            </Link>
            <Link
              to={`/admin/edit/${item.id}`}
              className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
            >
              Edit
            </Link>
          </div>
        </motion.aside>
      )}

      {viewingDisc && item && (
        <Suspense fallback={null}>
          <DiscViewer
            item={item}
            reducedMotion={reducedMotion}
            onClose={() => setViewingDisc(false)}
          />
        </Suspense>
      )}
    </AnimatePresence>
  )
}
