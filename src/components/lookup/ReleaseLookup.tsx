import { useState } from 'react'
import type { CollectionItemInput } from '../../data/schema'
import { fetchArtwork } from '../../services/coverArt'
import { extractDominantColor } from '../../services/dominantColor'
import {
  getRelease,
  searchAlbums,
  ServiceBusyError,
  type ReleaseSummary,
} from '../../services/musicbrainz'

interface ReleaseLookupProps {
  title: string
  artist: string
  onApply: (patch: Partial<CollectionItemInput>) => void
}

function pressingLine(release: ReleaseSummary): string {
  // The detail that separates the copy in her hand from six other pressings.
  return [
    release.date?.slice(0, 4),
    release.country,
    release.format,
    release.label,
    release.catalogNumber,
    release.trackCount ? `${release.trackCount} tracks` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function ReleaseLookup({ title, artist, onApply }: ReleaseLookupProps) {
  const [results, setResults] = useState<ReleaseSummary[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSearch = title.trim().length > 0 || artist.trim().length > 0

  async function handleSearch() {
    setSearching(true)
    setError(null)
    setResults(null)
    try {
      // Both fields go in as one phrase. Matching them as exact fielded terms
      // meant "Bloody Kiss" or "Sisters of Mercy" without its "The" found
      // nothing at all; the free-text search re-ranks instead of demanding
      // she already know the catalogued spelling.
      const found = await searchAlbums(`${title} ${artist}`.trim())
      setResults(found)
      if (found.length === 0) {
        setError('Nothing matched. Try fewer words, or check the spelling.')
      }
    } catch (err) {
      setError(
        err instanceof ServiceBusyError
          ? 'MusicBrainz is busy at the moment. Your record is probably there — try again shortly.'
          : err instanceof Error
            ? err.message
            : String(err),
      )
    } finally {
      setSearching(false)
    }
  }

  async function handleApply(release: ReleaseSummary) {
    setApplyingId(release.id)
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

      // Sampling needs the image loaded, so it happens last and is allowed to
      // come back empty without holding up everything else.
      if (artwork.front) {
        const colour = await extractDominantColor(artwork.front)
        if (colour) patch.dominantColor = colour
      }

      onApply(patch)
      setResults(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <section className="rounded-lg border border-velvet-700/50 bg-velvet-900/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm uppercase tracking-wide text-velvet-300">
            Look up this release
          </h3>
          <p className="mt-1 text-xs text-bone-400">
            Fills in the label, year, catalogue number, artwork and tracklist for you.
          </p>
        </div>
        <button
          type="button"
          disabled={!canSearch || searching}
          onClick={handleSearch}
          className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400 disabled:opacity-40"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {!canSearch && (
        <p className="mt-3 text-xs text-bone-400">Type a title or artist above first.</p>
      )}

      {error && <p className="mt-3 text-sm text-blood-300">{error}</p>}

      {results && results.length > 0 && (
        <>
          <p className="mt-4 text-xs text-bone-400">
            Pick the pressing that matches the copy you're holding — check the year, country and
            catalogue number on the back.
          </p>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {results.map((release) => (
              <li key={release.id}>
                <button
                  type="button"
                  disabled={applyingId !== null}
                  onClick={() => handleApply(release)}
                  className="w-full rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-velvet-700 hover:bg-void-900/70 disabled:opacity-40"
                >
                  <span className="block text-sm text-bone-100">
                    {release.title}
                    {release.artist && <span className="text-bone-400"> — {release.artist}</span>}
                  </span>
                  <span className="block text-xs text-bone-400">{pressingLine(release)}</span>
                  {applyingId === release.id && (
                    <span className="block pt-1 text-xs text-velvet-300">Fetching artwork…</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
