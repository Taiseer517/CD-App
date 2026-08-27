import type { CollectionItem } from '../../data/schema'

interface TopArtistCardProps {
  items: CollectionItem[]
}

export function TopArtistCard({ items }: TopArtistCardProps) {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!item.artistOrDirector) continue
    counts.set(item.artistOrDirector, (counts.get(item.artistOrDirector) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (ranked.length === 0) {
    return <p className="text-sm text-bone-400">No artist/director data yet.</p>
  }

  const [topName, topCount] = ranked[0]

  return (
    <div className="rounded-lg border border-void-700 bg-void-900/60 p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-bone-400">Most owned</p>
      <p className="mt-2 font-display text-2xl text-bone-100">{topName}</p>
      <p className="text-sm text-bone-400">
        {topCount} item{topCount === 1 ? '' : 's'}
      </p>

      {ranked.length > 1 && (
        <ul className="mt-4 space-y-1 border-t border-void-700 pt-3 text-sm text-bone-400">
          {ranked.slice(1).map(([name, count]) => (
            <li key={name} className="flex justify-between gap-3">
              <span className="truncate">{name}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
