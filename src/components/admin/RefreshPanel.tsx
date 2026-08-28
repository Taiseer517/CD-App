import { useState } from 'react'
import { useCollectionStore } from '../../store/useCollectionStore'

/**
 * Re-fetches records whose details are thinner than the sources now offer.
 *
 * The starter collection is only ever written once, on the very first visit.
 * A browser that opened the archive before TMDB was wired up therefore still
 * holds films with no poster, and no amount of updating the bundled data
 * reaches it — which is exactly what happened. This is the way back, and it
 * earns its place afterwards too, since services gain artwork over time.
 *
 * It never touches rating, notes, condition or date acquired. Those are hers.
 */
export function RefreshPanel() {
  const items = useCollectionStore((state) => state.items)
  const refreshMissingArtwork = useCollectionStore((state) => state.refreshMissingArtwork)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const missing = items.filter(
    (item) => !item.coverImageUrl && (item.musicbrainzId || item.tmdbId),
  )

  if (missing.length === 0 && !result) return null

  return (
    <section className="rounded-xl border border-void-700 bg-void-900/60 p-6">
      <h3 className="font-display text-lg text-bone-100">Records missing their artwork</h3>
      <p className="mt-2 max-w-prose text-sm text-bone-400">
        {missing.length > 0
          ? `${missing.length} ${missing.length === 1 ? 'record has' : 'records have'} no cover, but ${
              missing.length === 1 ? 'it names a source' : 'they name a source'
            } that can be asked again. Your ratings, notes and condition are left alone.`
          : 'Everything that can be fetched has been.'}
      </p>

      {missing.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bone-400">
          {missing.slice(0, 6).map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
          {missing.length > 6 && <li>and {missing.length - 6} more</li>}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {missing.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setResult(null)
              const repaired = await refreshMissingArtwork()
              setResult(
                repaired > 0
                  ? `Fetched artwork for ${repaired} ${repaired === 1 ? 'record' : 'records'}.`
                  : 'Nothing could be fetched — the services may be busy. Try again shortly.',
              )
              setBusy(false)
            }}
            className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400 disabled:opacity-50"
          >
            {busy ? 'Fetching…' : 'Fetch what is missing'}
          </button>
        )}
        {result && <p className="text-sm text-velvet-300">{result}</p>}
      </div>
    </section>
  )
}
