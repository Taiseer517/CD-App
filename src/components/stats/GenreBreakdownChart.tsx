import type { CollectionItem } from '../../data/schema'

interface GenreBreakdownChartProps {
  items: CollectionItem[]
}

export function GenreBreakdownChart({ items }: GenreBreakdownChartProps) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const genre = item.genre || 'Unspecified'
    counts.set(genre, (counts.get(genre) ?? 0) + 1)
  }

  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = rows.length > 0 ? rows[0][1] : 1

  if (rows.length === 0) {
    return <p className="text-sm text-bone-400">No genre data yet.</p>
  }

  return (
    <ul className="space-y-2">
      {rows.map(([genre, count]) => (
        <li key={genre} className="flex items-center gap-3" title={`${genre}: ${count}`}>
          <span className="w-40 shrink-0 truncate text-sm text-bone-200">{genre}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-void-800">
            <div
              className="h-full rounded-full bg-velvet-500 transition-[width] duration-500 hover:bg-velvet-400"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-sm text-bone-400">{count}</span>
        </li>
      ))}
    </ul>
  )
}
