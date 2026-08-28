import { useMemo } from 'react'
import { safeImageUrl } from '../../data/safeUrl'
import type { CollectionItem } from '../../data/schema'
import type { ShelfTheme } from '../../scenes/themes'
import { frameGeometry, GothicFrame } from './GothicFrame'

/**
 * A shelf of records, drawn as furniture rather than modelled as geometry.
 *
 * Cases stand face-out while a row has room and pack spine-out once it does
 * not, which is what people do with a real shelf and the only way a few
 * hundred discs fit. Hover tips one out of the row: a CSS rotation about the
 * left edge, which costs nothing and reads exactly like pulling a case
 * forward with a fingertip.
 */

/** Face-out until a row holds more than this, then spines. */
const FACE_OUT_LIMIT = 5
const SPINES_PER_ROW = 28

/**
 * A bookcase has shelves whether or not they are full. Drawing only the rows
 * that hold something left one shelf marooned under a great empty arch, which
 * reads as a broken layout rather than as room to grow.
 */
const MIN_ROWS = 4

interface ShelfCaseProps {
  items: CollectionItem[]
  theme: ShelfTheme
  selectedId: string | null
  onSelect: (item: CollectionItem) => void
}

function rowsFor(items: CollectionItem[]): CollectionItem[][] {
  if (items.length === 0) return Array.from({ length: MIN_ROWS }, () => [])

  const perRow = items.length <= FACE_OUT_LIMIT ? FACE_OUT_LIMIT : SPINES_PER_ROW
  const rows: CollectionItem[][] = []
  for (let index = 0; index < items.length; index += perRow) {
    rows.push(items.slice(index, index + perRow))
  }
  while (rows.length < MIN_ROWS) rows.push([])
  return rows
}

function Spine({
  item,
  selected,
  onSelect,
}: {
  item: CollectionItem
  selected: boolean
  onSelect: (item: CollectionItem) => void
}) {
  const accent = item.dominantColor || '#3a2c48'

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      title={`${item.title} — ${item.artistOrDirector}`}
      aria-pressed={selected}
      className={`group relative h-full shrink-0 origin-left rounded-[1px] transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-velvet-400 ${
        selected ? 'z-20' : 'hover:z-20'
      }`}
      style={{
        width: 'clamp(9px, 1.1vw, 15px)',
        transform: selected ? 'rotateY(-58deg) translateZ(14px)' : undefined,
      }}
    >
      <span
        className="absolute inset-0 rounded-[1px] border-y border-black/60 shadow-[1px_0_2px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:[transform:rotateY(-52deg)_translateZ(12px)]"
        style={{
          background: `linear-gradient(90deg, rgba(0,0,0,0.55), ${accent} 42%, rgba(0,0,0,0.5))`,
          transformOrigin: 'left center',
        }}
      >
        {/* The printed title, running up the spine as it does on a real case */}
        <span
          className="absolute inset-0 flex items-center justify-center overflow-hidden text-[7px] font-medium tracking-tight text-bone-100/85"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          <span className="truncate px-1">{item.title}</span>
        </span>
      </span>
    </button>
  )
}

function FaceOut({
  item,
  selected,
  onSelect,
}: {
  item: CollectionItem
  selected: boolean
  onSelect: (item: CollectionItem) => void
}) {
  const cover = safeImageUrl(item.coverImageUrl)

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      title={`${item.title} — ${item.artistOrDirector}`}
      aria-pressed={selected}
      className={`group relative h-full shrink-0 overflow-hidden rounded-[2px] border border-black/70 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.95)] transition-transform duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-velvet-400 ${
        selected ? '-translate-y-2 scale-[1.04] z-20' : 'hover:-translate-y-2 hover:scale-[1.04] hover:z-20'
      }`}
      style={{ aspectRatio: '1 / 1' }}
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          crossOrigin="anonymous"
          className="h-full w-full object-cover brightness-[0.88] transition-[filter] duration-300 group-hover:brightness-110"
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-velvet-900 to-void-950 p-1 text-center">
          <span className="font-display text-[8px] leading-tight text-bone-200">{item.title}</span>
          <span className="text-[7px] text-bone-400">{item.artistOrDirector}</span>
        </span>
      )}
    </button>
  )
}

export function ShelfCase({ items, theme, selectedId, onSelect }: ShelfCaseProps) {
  const rows = useMemo(() => rowsFor(items), [items])
  const spineMode = items.length > FACE_OUT_LIMIT

  // Only the shelf area varies; the ornament above and the plinth below are
  // fixed, so the case keeps its proportions whatever it holds.
  const rowHeight = spineMode ? 168 : 214
  const openingHeight = rows.length * rowHeight
  const geometry = frameGeometry(openingHeight)
  const frameHeight = geometry.height

  return (
    <div
      className="relative w-full"
      style={{ aspectRatio: `1000 / ${frameHeight}`, perspective: '900px' }}
    >
      <GothicFrame
        wood={theme.wood}
        woodDark={theme.woodDark}
        woodLight={theme.woodLight}
        metal={theme.metal}
        openingHeight={openingHeight}
      />

      {/* The records, laid over the drawn case inside its opening */}
      {/* Laid over the drawn case, inside the arch opening. The top is set
          below the springing so nothing overlaps the arch mouldings. */}
      <div
        className="absolute flex flex-col justify-end gap-2"
        style={{
          left: '12%',
          right: '12%',
          top: `${((geometry.openingTop + 12) / frameHeight) * 100}%`,
          bottom: `${((frameHeight - geometry.floor + 16) / frameHeight) * 100}%`,
        }}
      >
        {[...rows].reverse().map((row, index) => (
          <div key={index} className="relative flex-1">
            {/* What the records stand on */}
            <div
              className="absolute inset-x-[-2%] bottom-0 h-[7px] rounded-[2px]"
              style={{
                background: `linear-gradient(180deg, ${theme.woodLight}, ${theme.woodDark})`,
                boxShadow: `0 4px 10px -3px rgba(0,0,0,0.9)`,
              }}
            />
            {/* The pool of candlelight each shelf sits in */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 opacity-45"
              style={{
                background: `radial-gradient(ellipse 62% 100% at 76% 100%, ${theme.candleColor}22, transparent 70%)`,
              }}
            />

            <div
              className={`absolute inset-x-0 bottom-[7px] flex h-[86%] items-end overflow-hidden ${
                spineMode ? 'gap-[1px]' : 'gap-[6px]'
              }`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {row.map((item) =>
                spineMode ? (
                  <Spine
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={onSelect}
                  />
                ) : (
                  <FaceOut
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={onSelect}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
