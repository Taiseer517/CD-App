import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { CollectionItem } from '../../data/schema'
import { Rating } from '../common/Rating'

function duration(ms: number | null): string {
  if (!ms) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

interface CaseDetailPanelProps {
  item: CollectionItem | null
  onClose: () => void
}

/**
 * Details live in an HTML panel rather than as 3D text: at shelf distance,
 * rendered type is unreadable, and a tracklist needs to be selectable.
 */
export function CaseDetailPanel({ item, onClose }: CaseDetailPanelProps) {
  return (
    <AnimatePresence>
      {item && (
        <motion.aside
          key={item.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="pointer-events-auto absolute right-0 top-0 z-10 flex h-full w-full max-w-sm flex-col border-l border-void-700 bg-void-950/92 backdrop-blur-md"
          style={
            item.dominantColor
              ? { boxShadow: `inset 3px 0 24px -12px ${item.dominantColor}` }
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
              onClick={onClose}
              aria-label="Close details"
              className="shrink-0 rounded-md border border-void-700 px-2 py-1 text-bone-400 transition-colors hover:border-blood-500 hover:text-bone-100"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <Rating value={item.rating} />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Genre', item.genre],
                ['Label', item.label],
                ['Format', item.format],
                ['Catalogue', item.catalogNumber],
                ['Pressed in', item.country],
                ['Barcode', item.barcode],
                ['Condition', item.conditionOrEdition],
                ['Acquired', item.dateAcquired],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-bone-400">{label}</dt>
                    <dd className="text-bone-200">{value}</dd>
                  </div>
                ))}
            </dl>

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

          <div className="flex gap-3 border-t border-void-800 p-5">
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
    </AnimatePresence>
  )
}
