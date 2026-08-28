import { useState } from 'react'
import { Link } from 'react-router-dom'
import { findDuplicate, type DuplicateMatch } from '../../data/duplicates'
import { emptyCollectionItemInput, type CollectionItemInput } from '../../data/schema'
import { useCollectionStore } from '../../store/useCollectionStore'
import { fetchArtwork, frontCoverUrl } from '../../services/coverArt'
import { extractDominantColor } from '../../services/dominantColor'
import {
  getRelease,
  searchAlbums,
  ServiceBusyError,
  type ReleaseSummary,
} from '../../services/musicbrainz'
import { getFilm, isTmdbConfigured, searchFilms, type FilmSummary } from '../../services/tmdb'

/** A result from either service, kept distinct so neither is mislabelled. */
type SearchHit =
  | { kind: 'release'; release: ReleaseSummary }
  | { kind: 'film'; film: FilmSummary }

interface AlbumSearchProps {
  /** Wording differs between hunting for a wishlist and cataloguing a shelf. */
  actionLabel: string
  placeholder?: string
  onAdd: (input: CollectionItemInput) => Promise<void>
}

const hitId = (hit: SearchHit) =>
  hit.kind === 'release' ? hit.release.id : `film-${hit.film.id}`

/** The detail that separates the copy in her hand from six other pressings. */
function subtitleOf(hit: SearchHit): string {
  if (hit.kind === 'film') {
    return [hit.film.year, 'Film'].filter(Boolean).join(' · ')
  }
  const { date, country, format, label, catalogNumber } = hit.release
  return [date?.slice(0, 4), country, format, label, catalogNumber].filter(Boolean).join(' · ')
}

/**
 * Searches the world's records and films, and adds one straight into the
 * collection.
 *
 * Distinct from ReleaseLookup, which fills in a form she is already editing:
 * this is the browsing case, where she knows what she is hunting for and does
 * not want to type its details twice.
 */
export function AlbumSearch({ actionLabel, placeholder, onAdd }: AlbumSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [missingArt, setMissingArt] = useState<Set<string>>(new Set())
  const [duplicate, setDuplicate] = useState<{ hit: DuplicateMatch; pending: SearchHit } | null>(null)
  const collection = useCollectionStore((state) => state.items)

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    setResults(null)
    try {
      // Music and film are searched together, so she does not have to decide
      // which kind of thing she is looking for before she looks for it. A
      // film search that fails must not take the record results down with it.
      const [releases, films] = await Promise.all([
        searchAlbums(query),
        isTmdbConfigured() ? searchFilms(query).catch(() => []) : Promise.resolve([]),
      ])

      const found: SearchHit[] = [
        ...releases.map((release) => ({ kind: 'release' as const, release })),
        ...films.map((film) => ({ kind: 'film' as const, film })),
      ]
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

  async function handleAdd(hit: SearchHit, force = false) {
    const id = hitId(hit)

    // Check before fetching: it is easy to buy a record twice and easier
    // still to scan one twice, and there is no sense downloading artwork
    // for something she already owns.
    if (!force) {
      const existing = findDuplicate(
        hit.kind === 'film'
          ? { tmdbId: String(hit.film.id), title: hit.film.title }
          : {
              musicbrainzId: hit.release.id,
              barcode: hit.release.barcode,
              title: hit.release.title,
              artistOrDirector: hit.release.artist,
            },
        collection,
      )
      if (existing) {
        setDuplicate({ hit: existing, pending: hit })
        return
      }
    }

    setDuplicate(null)
    setAddingId(id)
    setError(null)
    try {
      const patch =
        hit.kind === 'film' ? await getFilm(hit.film.id) : await getRelease(hit.release.id)

      if (hit.kind === 'release') {
        const artwork = await fetchArtwork(hit.release.id)
        if (artwork.front) {
          patch.coverImageUrl = artwork.front
          patch.backgroundImageUrl = artwork.back || artwork.front
        }
        if (artwork.back) patch.backCoverImageUrl = artwork.back
        if (artwork.disc) patch.discImageUrl = artwork.disc
      }

      // Sampling needs the image loaded, so it happens last and is allowed to
      // come back empty without holding up everything else.
      if (patch.coverImageUrl) {
        const colour = await extractDominantColor(patch.coverImageUrl)
        if (colour) patch.dominantColor = colour
      }

      await onAdd({ ...emptyCollectionItemInput(), ...patch })
      setAdded((current) => new Set(current).add(id))
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
        Search {isTmdbConfigured() ? 'every record ever pressed, and every film' : 'every record ever pressed'}.
        Pick the one you want and it lands here with its artwork and details already filled in.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder ?? 'Album, artist or film…'}
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

      {duplicate && (
        <div className="mt-4 rounded-lg border border-blood-700 bg-blood-900/20 p-4">
          <p className="text-sm text-bone-100">
            You already have{' '}
            <span className="font-display">{duplicate.hit.existing.title}</span>
            {duplicate.hit.existing.artistOrDirector && (
              <span className="text-bone-400"> by {duplicate.hit.existing.artistOrDirector}</span>
            )}{' '}
            — {duplicate.hit.reason}.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              to={`/item/${duplicate.hit.existing.id}`}
              className="rounded border border-velvet-700 px-3 py-1 text-xs text-bone-100 transition-colors hover:border-velvet-400"
            >
              Open the one you have
            </Link>
            <button
              type="button"
              onClick={() => handleAdd(duplicate.pending, true)}
              className="rounded border border-blood-700 px-3 py-1 text-xs text-bone-200 transition-colors hover:border-blood-400"
            >
              {duplicate.hit.confidence === 'exact' ? 'Add it anyway' : 'Add this pressing too'}
            </button>
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              className="rounded border border-void-700 px-3 py-1 text-xs text-bone-400 transition-colors hover:border-bone-400"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      {results && results.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {results.map((hit) => {
            const id = hitId(hit)
            const isAdded = added.has(id)
            const title = hit.kind === 'film' ? hit.film.title : hit.release.title
            const artist = hit.kind === 'film' ? hit.film.overview : hit.release.artist
            const art =
              hit.kind === 'film' ? hit.film.posterUrl : frontCoverUrl(hit.release.id, 250)

            return (
              <li
                key={id}
                className="flex gap-3 rounded-lg border border-void-700 bg-void-900/50 p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-void-700 bg-void-800">
                  {art && !missingArt.has(id) && (
                    <img
                      src={art}
                      alt=""
                      loading="lazy"
                      crossOrigin="anonymous"
                      className="h-full w-full object-cover"
                      onError={() => setMissingArt((current) => new Set(current).add(id))}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone-100">{title}</p>
                  <p className="truncate text-xs text-bone-400">{artist}</p>
                  <p className="truncate text-xs text-bone-400">{subtitleOf(hit)}</p>

                  <button
                    type="button"
                    disabled={addingId !== null || isAdded}
                    onClick={() => handleAdd(hit)}
                    className={`mt-2 rounded border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${
                      isAdded
                        ? 'border-velvet-700 text-velvet-300'
                        : 'border-blood-700 text-bone-100 hover:border-blood-400'
                    }`}
                  >
                    {isAdded ? 'Added' : addingId === id ? 'Fetching artwork…' : actionLabel}
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
