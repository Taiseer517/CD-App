import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { safeImageUrl } from '../../data/safeUrl'
import type { CollectionItem } from '../../data/schema'
import type { ShelfTheme } from '../../scenes/themes'
import { ARCH_CLIP_ID, ARCH_INNER_CLIP_ID } from './ArchClip'

interface ShelfAlcoveProps {
  to: string
  name: string
  count: number
  items: CollectionItem[]
  index: number
  /** The wall wears the same room as the shelves behind it. */
  theme: ShelfTheme
  /** Absent for Unfiled, which is a gathering place rather than a shelf. */
  id?: string
  editMode?: boolean
  onRename?: (id: string, name: string) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  onDragStart?: () => void
  onDrop?: () => void
}

/**
 * One niche in the wall: a stone recess with records standing in it, lit from
 * below by a candle that rises as you approach.
 *
 * Two nested arches — an outer surround and an inner reveal — because a
 * single flat cutout reads as a sticker, while the offset between them gives
 * the wall its thickness.
 */
export function ShelfAlcove({
  to,
  name,
  count,
  items,
  index,
  theme,
  id,
  editMode = false,
  onRename,
  onDelete,
  onDragStart,
  onDrop,
}: ShelfAlcoveProps) {
  const standing = items.slice(0, 5)
  const glow = items.find((item) => item.dominantColor)?.dominantColor ?? theme.candleColor

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)

  // Unfiled has no id, and nothing about it can be renamed or taken down.
  const editable = editMode && Boolean(id)

  async function commitRename() {
    const next = draft.trim()
    setRenaming(false)
    if (!id || !next || next === name) return
    await onRename?.(id, next)
  }

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      onDragOver={editable ? (event) => event.preventDefault() : undefined}
      onDrop={
        editable
          ? (event) => {
              event.preventDefault()
              onDrop?.()
            }
          : undefined
      }
    >
      <Link to={to} className="group block focus:outline-none" aria-label={`Open the ${name} shelf`}>
        {/* Outer stone surround */}
        <div
          className="relative aspect-[4/5] p-[7px] transition-shadow duration-500 group-hover:shadow-[0_0_38px_-10px_var(--alcove-glow)] group-focus-visible:shadow-[0_0_38px_-10px_var(--alcove-glow)]"
          style={
            {
              clipPath: `url(#${ARCH_CLIP_ID})`,
              '--alcove-glow': glow,
              background: `linear-gradient(180deg, ${theme.woodLight} 0%, ${theme.wood} 55%, ${theme.woodDark} 100%)`,
            } as React.CSSProperties
          }
        >
          {/* Inner reveal — the recess itself */}
          <div
            className="relative h-full w-full overflow-hidden"
            style={{ clipPath: `url(#${ARCH_INNER_CLIP_ID})` }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 50% 112%, ${theme.wood} 0%, ${theme.woodDark} 52%, #07050a 100%)`,
              }}
            />

            {/* The record's own colour, welling up out of the niche */}
            <div
              className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-95"
              style={{ background: `radial-gradient(ellipse at 50% 100%, ${glow}55, transparent 58%)` }}
            />

            {/* Shadow cast by the wall's thickness, along the top of the arch */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/75 to-transparent" />

            {/* Records standing on the plank */}
            <div className="absolute inset-x-0 bottom-[19%] flex items-end justify-center gap-[4px] px-[13%]">
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
                      className="h-full w-full object-cover brightness-[0.82] transition-[filter,transform] duration-700 group-hover:scale-[1.04] group-hover:brightness-105"
                      onError={(event) => {
                        event.currentTarget.style.visibility = 'hidden'
                      }}
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
            <div
              className="absolute inset-x-[6%] bottom-[16.5%] h-[7px] rounded-[2px]"
              style={{
                background: `linear-gradient(180deg, ${theme.woodLight}, ${theme.wood} 45%, ${theme.woodDark})`,
              }}
            />

            {/* Candle */}
            <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2">
              <div className="mx-auto h-7 w-[8px] rounded-t-[2px] bg-gradient-to-b from-[#efe3ca] via-[#cabfa6] to-[#8e836d]" />
              <motion.div
                className="absolute -top-[9px] left-1/2 h-[13px] w-[6px] -translate-x-1/2 rounded-[50%]"
                style={{ background: theme.candleColor }}
                animate={{ scaleY: [1, 1.14, 0.94, 1.08, 1], opacity: [0.9, 1, 0.86, 1, 0.9] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div
                className="absolute -top-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full opacity-30 blur-2xl transition-opacity duration-700 group-hover:opacity-70"
                style={{ background: theme.candleColor }}
              />
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
            <span className="block truncate font-display text-[0.74rem] uppercase tracking-[0.16em] text-[#f4e9d0]">
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

      {/* Kept outside the Link rather than inside it: a button nested in an
          anchor is both invalid and unpredictable, and the tile has to stay an
          ordinary link the rest of the time. */}
      {editable && (
        <>
          <span
            draggable
            onDragStart={onDragStart}
            title="Drag to move this shelf"
            aria-hidden="true"
            className="absolute left-1 top-1 z-30 cursor-grab rounded border border-void-700 bg-void-950/85 px-1.5 py-0.5 text-xs leading-none text-bone-300 active:cursor-grabbing"
          >
            ⠿
          </span>

          <div className="absolute right-1 top-1 z-30 flex gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(name)
                setRenaming(true)
              }}
              title={`Rename the ${name} shelf`}
              className="rounded border border-void-700 bg-void-950/85 px-1.5 py-0.5 text-xs leading-none text-bone-300 transition-colors hover:border-velvet-400 hover:text-bone-100"
            >
              ✎<span className="sr-only">Rename {name}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!id) return
                if (!window.confirm(`Take down the "${name}" shelf? Its records move to Unfiled.`)) return
                await onDelete?.(id)
              }}
              title={`Take down the ${name} shelf`}
              className="rounded border border-void-700 bg-void-950/85 px-1.5 py-0.5 text-xs leading-none text-bone-300 transition-colors hover:border-blood-400 hover:text-blood-300"
            >
              ✕<span className="sr-only">Take down {name}</span>
            </button>
          </div>
        </>
      )}

      {renaming && (
        <div className="absolute inset-x-[6%] bottom-8 z-40">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void commitRename()
              if (event.key === 'Escape') setRenaming(false)
            }}
            aria-label={`Rename the ${name} shelf`}
            className="w-full rounded border border-velvet-400 bg-void-950 px-2 py-1 text-center text-sm text-bone-100 focus:outline-none"
          />
        </div>
      )}
    </motion.div>
  )
}
