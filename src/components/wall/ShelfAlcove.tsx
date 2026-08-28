import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { safeImageUrl } from '../../data/safeUrl'
import type { CollectionItem } from '../../data/schema'
import { ARCH_CLIP_ID, ARCH_INNER_CLIP_ID } from './ArchClip'

interface ShelfAlcoveProps {
  to: string
  name: string
  count: number
  items: CollectionItem[]
  index: number
}

/**
 * One niche in the wall: a stone recess with records standing in it, lit from
 * below by a candle that rises as you approach.
 *
 * Two nested arches — an outer surround and an inner reveal — because a
 * single flat cutout reads as a sticker, while the offset between them gives
 * the wall its thickness.
 */
export function ShelfAlcove({ to, name, count, items, index }: ShelfAlcoveProps) {
  const standing = items.slice(0, 6)
  const glow = items.find((item) => item.dominantColor)?.dominantColor ?? '#8a5cc0'

  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={to} className="group block focus:outline-none" aria-label={`Open the ${name} shelf`}>
        {/* Outer stone surround */}
        <div
          className="relative aspect-[5/6] bg-gradient-to-b from-[#3b2d4c] via-[#2a2038] to-[#1b1426] p-[7px] transition-shadow duration-500 group-hover:shadow-[0_0_38px_-10px_var(--alcove-glow)] group-focus-visible:shadow-[0_0_38px_-10px_var(--alcove-glow)]"
          style={
            { clipPath: `url(#${ARCH_CLIP_ID})`, '--alcove-glow': glow } as React.CSSProperties
          }
        >
          {/* Inner reveal — the recess itself */}
          <div
            className="relative h-full w-full overflow-hidden"
            style={{ clipPath: `url(#${ARCH_INNER_CLIP_ID})` }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_112%,#3a2a4e_0%,#170f22_54%,#0a070e_100%)]" />

            {/* The record's own colour, welling up out of the niche */}
            <div
              className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-95"
              style={{ background: `radial-gradient(ellipse at 50% 100%, ${glow}55, transparent 58%)` }}
            />

            {/* Shadow cast by the wall's thickness, along the top of the arch */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/75 to-transparent" />

            {/* Records standing on the plank */}
            <div className="absolute inset-x-0 bottom-[19%] flex items-end justify-center gap-[3px] px-[11%]">
              {standing.map((item, position) => (
                <motion.div
                  key={item.id}
                  className="relative aspect-square w-full overflow-hidden rounded-[2px] border border-black/70 bg-void-800 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.95)]"
                  animate={{ rotate: (position - (standing.length - 1) / 2) * 1.1 }}
                  whileHover={{ y: -8 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 22 }}
                >
                  {item.coverImageUrl ? (
                    <img
                      src={safeImageUrl(item.coverImageUrl)}
                      alt=""
                      loading="lazy"
                      crossOrigin="anonymous"
                      className="h-full w-full object-cover brightness-[0.82] transition-[filter,transform] duration-700 group-hover:scale-[1.04] group-hover:brightness-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-velvet-900 to-void-950">
                      <span className="font-display text-[8px] uppercase tracking-widest text-bone-400/50">
                        {item.type}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* The plank, with its lit front edge */}
            <div className="absolute inset-x-[6%] bottom-[16.5%] h-[7px] rounded-[2px] bg-gradient-to-b from-[#5a4770] via-[#33254a] to-[#1c1329]" />

            {/* Candle */}
            <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2">
              <div className="mx-auto h-7 w-[8px] rounded-t-[2px] bg-gradient-to-b from-[#efe3ca] via-[#cabfa6] to-[#8e836d]" />
              <motion.div
                className="absolute -top-[9px] left-1/2 h-[13px] w-[6px] -translate-x-1/2 rounded-[50%] bg-[#ffbc6a]"
                animate={{ scaleY: [1, 1.14, 0.94, 1.08, 1], opacity: [0.9, 1, 0.86, 1, 0.9] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute -top-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-[#ff9a3c] opacity-30 blur-2xl transition-opacity duration-700 group-hover:opacity-70" />
            </div>

            {count === 0 && (
              <div className="absolute inset-0 flex items-end justify-center pb-[38%]">
                <span className="font-display text-[0.6rem] uppercase tracking-[0.3em] text-bone-400/40">
                  Empty
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brass nameplate, screwed to the wall beneath the niche */}
        <div className="relative mx-auto -mt-4 w-[88%]">
          <div className="relative rounded-[3px] border border-[#4a3c22] bg-gradient-to-b from-[#9a7c4d] via-[#75603a] to-[#4e3d24] px-3 py-1.5 text-center shadow-[0_5px_12px_-4px_rgba(0,0,0,0.95)] transition-[filter] duration-500 group-hover:brightness-115">
            <span className="block truncate font-display text-[0.68rem] uppercase tracking-[0.18em] text-[#f4e9d0]">
              {name}
            </span>
            {[0, 1].map((side) => (
              <span
                key={side}
                className="absolute top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-[#3a2f1c]"
                style={side === 0 ? { left: 5 } : { right: 5 }}
              />
            ))}
          </div>
        </div>

        <p className="mt-2 text-center text-xs tracking-wide text-bone-400">
          {count} {count === 1 ? 'record' : 'records'}
        </p>
      </Link>
    </motion.div>
  )
}
