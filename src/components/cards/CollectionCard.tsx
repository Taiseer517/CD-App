import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { safeImageUrl } from '../../data/safeUrl'
import type { CollectionItem } from '../../data/schema'
import { Rating } from '../common/Rating'

interface CollectionCardProps {
  item: CollectionItem
  dimmed?: boolean
}

const typeLabel: Record<CollectionItem['type'], string> = {
  cd: 'CD',
  dvd: 'DVD',
  vinyl: 'LP',
}

export function CollectionCard({ item, dimmed = false }: CollectionCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={dimmed ? 'opacity-90 grayscale transition-opacity hover:opacity-100 hover:grayscale-0' : ''}
    >
      <Link
        to={`/item/${item.id}`}
        className={`group block overflow-hidden rounded-lg shadow-lg shadow-black/40 transition-colors ${
          dimmed
            ? 'border border-dashed border-bone-400/40 bg-void-800 hover:border-blood-500'
            : 'border border-void-700 bg-void-900 hover:border-blood-700'
        }`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-velvet-900 via-void-900 to-void-950">
          {item.coverImageUrl ? (
            <img
              src={safeImageUrl(item.coverImageUrl)}
              alt={`${item.title} cover art`}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.visibility = 'hidden'
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-3xl tracking-widest text-bone-400/30">
                {typeLabel[item.type]}
              </span>
            </div>
          )}
          <span className="absolute right-2 top-2 rounded-full bg-void-950/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-bone-400">
            {typeLabel[item.type]}
          </span>
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate font-display text-base text-bone-100">{item.title}</p>
          <p className="truncate text-sm text-bone-400">{item.artistOrDirector}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="truncate text-xs uppercase tracking-wide text-velvet-300">
              {item.genre || '—'}
            </span>
            <Rating value={item.rating} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
