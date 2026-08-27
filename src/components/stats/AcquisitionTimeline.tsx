import type { CollectionItem } from '../../data/schema'

interface AcquisitionTimelineProps {
  items: CollectionItem[]
}

export function AcquisitionTimeline({ items }: AcquisitionTimelineProps) {
  const counts = new Map<number, number>()
  for (const item of items) {
    if (!item.dateAcquired) continue
    const year = new Date(item.dateAcquired).getFullYear()
    if (Number.isNaN(year)) continue
    counts.set(year, (counts.get(year) ?? 0) + 1)
  }

  const rows = [...counts.entries()].sort((a, b) => a[0] - b[0])
  const max = rows.reduce((acc, [, count]) => Math.max(acc, count), 1)

  if (rows.length === 0) {
    return <p className="text-sm text-bone-400">No acquisition dates recorded yet.</p>
  }

  return (
    <div className="flex items-end gap-4 overflow-x-auto pb-2">
      {rows.map(([year, count]) => (
        <div key={year} className="flex flex-col items-center gap-2" title={`${year}: ${count}`}>
          <span className="text-xs text-bone-400">{count}</span>
          <div
            className="w-6 rounded-t-full bg-blood-500 transition-colors hover:bg-blood-400"
            style={{ height: `${(count / max) * 96 + 8}px` }}
          />
          <span className="text-xs uppercase tracking-wide text-bone-400">{year}</span>
        </div>
      ))}
    </div>
  )
}
