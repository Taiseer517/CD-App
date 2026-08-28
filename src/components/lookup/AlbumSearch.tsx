import { useState } from 'react'
import type { CollectionItemInput } from '../../data/schema'
import { emptyCollectionItemInput } from '../../data/schema'
import { fetchArtwork, frontCoverUrl } from '../../services/coverArt'
import { extractDominantColor } from '../../services/dominantColor'
import {
  getRelease,
  searchAlbums,
  ServiceBusyError,
  type ReleaseSummary,
} from '../../services/musicbrainz'

interface AlbumSearchProps {
  /** Wording differs between hunting for a wishlist and cataloguing a shelf. */
  actionLabel: string
  placeholder?: string
  onAdd: (input: CollectionItemInput) => Promise<void>
}

function pressingLine(release: ReleaseSummary): string {
  return [
    release.date?.slice(0, 4),
    release.country,
    release.format,
    release.label,
    release.catalogNumber,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Searches the world's records and adds one straight into the collection.
 *
 * Distinct from ReleaseLookup, which fills in a form she is already editing:
 * this is the browsing case, where she knows what she is hunting for and does
 * not want to type its details twice.
 */
export function AlbumSearch({ actionLabel, placeholder, onAdd }: AlbumSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReleaseSummary[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [missingArt, setMissingArt] = useState<Set<string>>(new Set())

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    setResults(null)
    try {
      const found = await searchAlbums(query)
      setResults(found)
      if (found.length === 0) setError('Nothing matched. Try fewer words, or a different spelling.')
    } catch (err) {
      setError(
        err instanceof ServiceBusyError
          ? 'MusicBrainz is busy at the moment. What you are after is probably there — try again shortly.'
          : err instanceof Error
            ? err.message
            : String(err),
      )
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(release: ReleaseSummary) {
    setAddingId(release.id)
    setError(null)
    try {
      const patch = await getRelease(release.id)
      const artwork = await fetchArtwork(release.id)

      if (artwork.front) {
        patch.coverImageUrl = artwork.front
        patch.backgroundImageUrl = artwork.back || artwork.front
      }
      if (artwork.back) patch.backCoverImageUrl = artwork.back
      if (artwork.disc) patch.discImageUrl = artwork.disc
      if (artwork.front) {
        const colour = await extractDominantColor(artwork.front)
        if (colour) patch.dominantColor = colour
      }

      await onAdd({ ...emptyCollectionItemInput(), ...patch })
      setAdded((current) => new Set(current).add(release.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingId(null)
    }
  }

  return (
    <section className="rounded-xl border border-velvet-700/40 bg-velvet-900/15 p-5">
      <h3 className="font-display text-lg text-bone-100">Go hunting</h3>
      <p className="mt-1 text-sm text-bone-400">
        Search every record ever pressed. Pick the one you want and it lands here with its
        artwork and details already filled in.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder ?? 'Album or artist…'}
          className="min-w-0 flex-1 rounded-md border border-void-700 bg-void-950 px-3 py-2 text-bone-100 placeholder:text-bone-400/50 focus:border-velvet-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="rounded-md border border-velvet-700 px-5 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400 disabled:opacity-40"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-blood-300">{error}</p>}

      {results && results.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {results.map((release) => {
            const isAdded = added.has(release.id)
            const hasArt = !missingArt.has(release.id)
            return (
              <li
                key={release.id}
                className="flex gap-3 rounded-lg border border-void-700 bg-void-900/50 p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-void-700 bg-void-800">
                  {hasArt && (
                    <img
                      src={frontCoverUrl(release.id, 250)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={() =>
                        setMissingArt((current) => new Set(current).add(release.id))
                      }
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone-100">{release.title}</p>
                  <p className="truncate text-xs text-bone-400">{release.artist}</p>
                  <p className="truncate text-xs text-bone-400">{pressingLine(release)}</p>

                  <button
                    type="button"
                    disabled={addingId !== null || isAdded}
                    onClick={() => handleAdd(release)}
                    className={`mt-2 rounded border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${
                      isAdded
                        ? 'border-velvet-700 text-velvet-300'
                        : 'border-blood-700 text-bone-100 hover:border-blood-400'
                    }`}
                  >
                    {isAdded
                      ? 'Added'
                      : addingId === release.id
                        ? 'Fetching artwork…'
                        : actionLabel}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
