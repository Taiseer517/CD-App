import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { archiveAudio } from '../../audio/archiveAudio'
import { safeImageUrl } from '../../data/safeUrl'
import type { CollectionItem } from '../../data/schema'
import type { ShelfTheme } from '../../scenes/themes'

/**
 * The rack a shelf's records actually stand in.
 *
 * The drawn bookcase that used to be here spent its whole budget on vector
 * woodwork, and the trouble with drawn carving is that it competes with the
 * sleeves and loses: the artwork is the beautiful thing on this page, and a
 * cartoon frame around it makes it look worse, not better.
 *
 * So the furniture is reduced to what furniture actually does — a rail to
 * stand on, a shadow underneath, a wall behind, and light falling across it —
 * and every remaining pixel goes to the records. Depth comes from contact
 * shadows and light falloff rather than from outlines, which is the whole
 * difference between a photograph of a shelf and a drawing of one.
 */

export type Density = 'covers' | 'spines'

interface RecordRackProps {
  items: CollectionItem[]
  theme: ShelfTheme
  selectedId: string | null
  density: Density
  onSelect: (item: CollectionItem) => void
  onReorder: (orderedIds: string[]) => void
}

/** How many stand on one shelf before the next one starts. */
const PER_ROW: Record<Density, number> = { covers: 6, spines: 34 }

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size))
  }
  return rows.length > 0 ? rows : [[]]
}

/**
 * The rail records stand on: a lit top edge, a body, and the shadow it casts
 * into the shelf below. Three flat bands do more for depth than any amount of
 * drawn moulding.
 */
function ShelfRail({ theme }: { theme: ShelfTheme }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true">
      <div
        className="h-[3px] rounded-t-[1px]"
        style={{ background: `linear-gradient(180deg, ${theme.woodLight}, ${theme.wood})` }}
      />
      <div
        className="h-[9px]"
        style={{ background: `linear-gradient(180deg, ${theme.wood}, ${theme.woodDark})` }}
      />
      <div className="h-6 bg-gradient-to-b from-black/70 to-transparent" />
    </div>
  )
}

function Cover({
  item,
  selected,
  focused,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  item: CollectionItem
  selected: boolean
  focused: boolean
  onSelect: () => void
  onDragStart: () => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: () => void
}) {
  const cover = safeImageUrl(item.coverImageUrl)
  const accent = item.dominantColor || '#7c4fb0'

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onPointerEnter={() => archiveAudio.tip()}
      aria-pressed={selected}
      data-rack-item={item.id}
      title={`${item.title}${item.artistOrDirector ? ` — ${item.artistOrDirector}` : ''}`}
      className={`group relative block aspect-square min-w-0 flex-1 cursor-grab origin-bottom rounded-[3px] transition-[transform,filter] duration-300 ease-out active:cursor-grabbing focus:outline-none ${
        selected || focused ? 'z-20 -translate-y-3 scale-[1.05]' : 'hover:z-20 hover:-translate-y-3 hover:scale-[1.05]'
      }`}
      style={{
        // Records lean back against the shelf rather than standing to
        // attention, which is what stops a row looking like a spreadsheet.
        transform: selected || focused ? undefined : 'perspective(900px) rotateX(2.5deg)',
      }}
    >
      {/* Contact shadow: tight and dark where the sleeve meets the rail. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-1 -bottom-1 h-3 rounded-[50%] bg-black/80 blur-[5px] transition-opacity duration-300 group-hover:opacity-60"
      />

      <span
        className={`relative block h-full w-full overflow-hidden rounded-[3px] border transition-shadow duration-300 ${
          selected || focused ? 'border-velvet-400' : 'border-black/70'
        }`}
        style={{
          boxShadow:
            selected || focused
              ? `0 18px 32px -14px rgba(0,0,0,0.95), 0 0 26px -8px ${accent}`
              : '0 12px 22px -12px rgba(0,0,0,0.95)',
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            crossOrigin="anonymous"
            className="h-full w-full object-cover brightness-[0.86] transition-[filter] duration-300 group-hover:brightness-105"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-velvet-900 to-void-950 p-2 text-center">
            <span className="font-display text-[0.7rem] leading-tight text-bone-200">
              {item.title}
            </span>
            <span className="text-[0.6rem] text-bone-400">{item.artistOrDirector}</span>
          </span>
        )}

        {/* Sheen across the shrinkwrap, brightest where the light is. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-transparent"
        />
      </span>

      {/* The name, only while it is being looked at, so a full shelf is
          artwork rather than a wall of captions. */}
      <span
        className={`pointer-events-none absolute inset-x-0 top-full mt-2 block truncate px-1 text-center text-[0.68rem] leading-tight transition-opacity duration-200 ${
          selected || focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="block truncate font-display text-bone-100">{item.title}</span>
        <span className="block truncate text-bone-400">{item.artistOrDirector}</span>
      </span>
    </button>
  )
}

function Spine({
  item,
  selected,
  focused,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  item: CollectionItem
  selected: boolean
  focused: boolean
  onSelect: () => void
  onDragStart: () => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: () => void
}) {
  const accent = item.dominantColor || '#3f3350'

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onPointerEnter={() => archiveAudio.tip()}
      aria-pressed={selected}
      data-rack-item={item.id}
      title={`${item.title}${item.artistOrDirector ? ` — ${item.artistOrDirector}` : ''}`}
      className={`group relative h-full min-w-0 flex-1 cursor-grab rounded-[1px] transition-transform duration-300 focus:outline-none ${
        selected || focused ? 'z-20 -translate-y-2' : 'hover:z-20 hover:-translate-y-2'
      }`}
    >
      <span
        className={`relative block h-full w-full overflow-hidden rounded-[1px] border-y border-black/70 ${
          selected || focused ? 'ring-1 ring-velvet-400' : ''
        }`}
        style={{
          // A spine is a curved plastic edge: dark at both sides, lit down
          // one face. A flat fill reads as a barcode.
          background: `linear-gradient(90deg, rgba(0,0,0,0.75), ${accent} 38%, ${accent} 58%, rgba(0,0,0,0.7))`,
          boxShadow: '1px 0 2px rgba(0,0,0,0.8)',
        }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center overflow-hidden px-[1px] text-[0.55rem] font-medium tracking-tight text-bone-100/90"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          <span className="truncate">{item.title}</span>
        </span>
      </span>
    </button>
  )
}

export function RecordRack({
  items,
  theme,
  selectedId,
  density,
  onSelect,
  onReorder,
}: RecordRackProps) {
  const rows = useMemo(() => chunk(items, PER_ROW[density]), [items, density])
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const dragFrom = useRef<string | null>(null)
  const rackRef = useRef<HTMLDivElement>(null)

  const move = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return
      const order = items.map((item) => item.id)
      const from = order.indexOf(fromId)
      const to = order.indexOf(toId)
      if (from === -1 || to === -1) return
      order.splice(to, 0, ...order.splice(from, 1))
      onReorder(order)
      archiveAudio.pull()
    },
    [items, onReorder],
  )

  // Arrow keys walk the rack, so three hundred records do not mean three
  // hundred tab stops.
  useEffect(() => {
    const element = rackRef.current
    if (!element) return

    function onKey(event: KeyboardEvent) {
      if (!element) return
      const perRow = PER_ROW[density]
      const current = focusIndex ?? items.findIndex((item) => item.id === selectedId)
      const at = current === -1 ? 0 : current

      const step: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: perRow,
        ArrowUp: -perRow,
      }

      if (event.key in step) {
        event.preventDefault()
        const next = Math.max(0, Math.min(items.length - 1, at + step[event.key]))
        setFocusIndex(next)
        element
          .querySelector<HTMLElement>(`[data-rack-item="${items[next]?.id}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        return
      }

      if ((event.key === 'Enter' || event.key === ' ') && focusIndex !== null) {
        event.preventDefault()
        const item = items[focusIndex]
        if (item) onSelect(item)
      }
    }

    element.addEventListener('keydown', onKey)
    return () => element.removeEventListener('keydown', onKey)
  }, [density, focusIndex, items, onSelect, selectedId])

  const focusedId = focusIndex !== null ? items[focusIndex]?.id : null

  return (
    <div
      ref={rackRef}
      tabIndex={0}
      role="group"
      aria-label="The records on this shelf. Use the arrow keys to move along it."
      className="relative overflow-hidden rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-velvet-700"
      style={{
        // The wall behind: a warm pool where the light falls, going to near
        // black at the edges. This is the whole backdrop, and it does more
        // for the look than any amount of drawn woodwork did.
        background: `radial-gradient(120% 80% at 22% 0%, ${theme.wood}55, transparent 62%),
                     radial-gradient(90% 70% at 78% 100%, ${theme.candleColor}12, transparent 65%),
                     linear-gradient(180deg, #0c0a10, #070509)`,
      }}
    >
      {/* Boarding on the back wall, barely there — enough to catch the light
          and stop the ground reading as flat paint. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 74px)',
        }}
      />

      <div className="relative space-y-11 p-6 sm:p-10">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="relative pb-12">
            <div
              className={`flex items-end ${density === 'covers' ? 'gap-4 sm:gap-6' : 'gap-[2px]'} ${
                density === 'covers' ? 'min-h-[9rem]' : 'h-40'
              }`}
            >
              {row.map((item) =>
                density === 'covers' ? (
                  <Cover
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    focused={item.id === focusedId}
                    onSelect={() => onSelect(item)}
                    onDragStart={() => {
                      dragFrom.current = item.id
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dragFrom.current && move(dragFrom.current, item.id)}
                  />
                ) : (
                  <Spine
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    focused={item.id === focusedId}
                    onSelect={() => onSelect(item)}
                    onDragStart={() => {
                      dragFrom.current = item.id
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dragFrom.current && move(dragFrom.current, item.id)}
                  />
                ),
              )}

              {/* Empty rows still get their rail, so a half-filled shelf reads
                  as room to grow rather than as a layout that stopped. */}
              {row.length === 0 && <div className="h-full flex-1" />}
            </div>

            <ShelfRail theme={theme} />
          </div>
        ))}
      </div>
    </div>
  )
}
