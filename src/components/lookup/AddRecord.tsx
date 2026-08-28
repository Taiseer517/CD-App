import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { archiveAudio } from '../../audio/archiveAudio'
import { findDuplicate, type DuplicateMatch } from '../../data/duplicates'
import { emptyCollectionItemInput, type CollectionItemInput } from '../../data/schema'
import { fetchArtwork, frontCoverUrl } from '../../services/coverArt'
import { extractDominantColor } from '../../services/dominantColor'
import {
  getRelease,
  searchAlbums,
  searchByBarcode,
  ServiceBusyError,
  type ReleaseSummary,
} from '../../services/musicbrainz'
import { getFilm, isTmdbConfigured, searchFilms, type FilmSummary } from '../../services/tmdb'
import { useCollectionStore } from '../../store/useCollectionStore'
import { BarcodeScanner, detectorSupported } from './BarcodeScanner'

/**
 * Finding a record and putting it in the archive.
 *
 * Two things made the old search hard to trust. It listed every pressing
 * flat, so twenty rows reading "Bloody Kisses — Type O Negative" gave no way
 * to tell which was meant; and it added on a single click, so being wrong
 * cost a delete. Results are now grouped by album — pick the record first,
 * then the pressing — and nothing is added until it has been shown in full
 * and confirmed.
 */

type Hit =
  | { kind: 'release'; release: ReleaseSummary }
  | { kind: 'film'; film: FilmSummary }

interface AlbumGroup {
  key: string
  title: string
  artist: string
  year: string
  pressings: ReleaseSummary[]
}

interface AddRecordProps {
  /** Wishlist adds are the same flow with a different destination. */
  destination: 'collection' | 'wishlist'
  onAdd: (input: CollectionItemInput) => Promise<void>
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** One card per album, with its pressings gathered underneath. */
function groupReleases(releases: ReleaseSummary[]): AlbumGroup[] {
  const groups = new Map<string, AlbumGroup>()

  for (const release of releases) {
    const key = `${normalise(release.title)}|${normalise(release.artist)}`
    const existing = groups.get(key)
    if (existing) {
      existing.pressings.push(release)
      // The earliest date is the album's year; later ones are reissues.
      const year = release.date?.slice(0, 4)
      if (year && (!existing.year || year < existing.year)) existing.year = year
    } else {
      groups.set(key, {
        key,
        title: release.title,
        artist: release.artist,
        year: release.date?.slice(0, 4) ?? '',
        pressings: [release],
      })
    }
  }

  return [...groups.values()]
}

function pressingLine(release: ReleaseSummary): string {
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

export function AddRecord({ destination, onAdd }: AddRecordProps) {
  const [query, setQuery] = useState('')
  const [artist, setArtist] = useState('')
  const [groups, setGroups] = useState<AlbumGroup[] | null>(null)
  const [films, setFilms] = useState<FilmSummary[]>([])
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const [chosen, setChosen] = useState<Hit | null>(null)
  const [preview, setPreview] = useState<Partial<CollectionItemInput> | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null)
  const [scanning, setScanning] = useState(false)

  const label = destination === 'wishlist' ? 'wishlist' : 'collection'

  const collectionForDuplicates = useCollectionStore((state) => state.items)

  const showFilms = isTmdbConfigured()

  const total = useMemo(
    () => (groups?.reduce((sum, group) => sum + group.pressings.length, 0) ?? 0) + films.length,
    [groups, films],
  )

  function reset() {
    setChosen(null)
    setPreview(null)
    setDuplicate(null)
  }

  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault()
    if (!query.trim()) return

    setSearching(true)
    setError(null)
    setGroups(null)
    setFilms([])
    setOpenGroup(null)
    reset()

    try {
      // The artist field is optional, but when given it is added to the query
      // rather than filtered afterwards — the service ranks far better with it.
      const phrase = [query, artist].filter((part) => part.trim()).join(' ')
      const [releases, foundFilms] = await Promise.all([
        searchAlbums(phrase),
        showFilms ? searchFilms(phrase).catch(() => []) : Promise.resolve([]),
      ])

      const grouped = groupReleases(releases)
      setGroups(grouped)
      setFilms(foundFilms)

      if (grouped.length === 0 && foundFilms.length === 0) {
        setError('Nothing matched. Try fewer words, or check the spelling.')
      } else if (grouped.length === 1 && foundFilms.length === 0) {
        // Only one album matched, so open its pressings without a second click.
        setOpenGroup(grouped[0].key)
      }
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

  async function handleBarcode(code: string) {
    setSearching(true)
    setError(null)
    reset()
    try {
      const releases = await searchByBarcode(code)
      if (releases.length === 0) {
        setError(`Nothing is catalogued under barcode ${code}. Try the title instead.`)
        return
      }
      const grouped = groupReleases(releases)
      setGroups(grouped)
      setFilms([])
      setOpenGroup(grouped[0]?.key ?? null)
      // A barcode names one pressing, so go straight to showing it.
      if (releases.length === 1) void choose({ kind: 'release', release: releases[0] })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearching(false)
    }
  }

  /** Fetches the full record and shows it, without adding anything yet. */
  async function choose(hit: Hit) {
    setChosen(hit)
    setPreview(null)
    setDuplicate(null)
    setLoadingPreview(true)
    setError(null)
    archiveAudio.pull()

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

      setPreview(patch)
      setDuplicate(
        findDuplicate(
          {
            musicbrainzId: patch.musicbrainzId,
            tmdbId: patch.tmdbId,
            barcode: patch.barcode,
            title: patch.title,
            artistOrDirector: patch.artistOrDirector,
          },
          collectionForDuplicates,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setChosen(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function confirm() {
    if (!preview) return
    setAdding(true)
    try {
      const patch = { ...preview }
      if (patch.coverImageUrl) {
        const colour = await extractDominantColor(patch.coverImageUrl)
        if (colour) patch.dominantColor = colour
      }
      await onAdd({ ...emptyCollectionItemInput(), ...patch })
      setAdded(patch.title ?? 'It')
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="rounded-xl border border-velvet-700/40 bg-velvet-900/15 p-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div>
          <h3 className="font-display text-lg text-bone-100">
            Add to the {label}
          </h3>
          <p className="mt-1 text-sm text-bone-400">
            Search {showFilms ? 'every record ever pressed, and every film' : 'every record ever pressed'}.
            Pick the album, then the pressing you actually own.
          </p>

          <form onSubmit={runSearch} className="mt-4 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Album or film title…"
              className="min-w-[10rem] flex-[2] rounded-md border border-void-700 bg-void-950 px-3 py-2 text-bone-100 placeholder:text-bone-400/50 focus:border-velvet-400 focus:outline-none"
            />
            <input
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="Artist (optional)"
              className="min-w-[8rem] flex-1 rounded-md border border-void-700 bg-void-950 px-3 py-2 text-bone-100 placeholder:text-bone-400/50 focus:border-velvet-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!query.trim() || searching}
              className="rounded-md border border-velvet-700 px-5 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400 disabled:opacity-40"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
            {detectorSupported() && (
              <button
                type="button"
                onClick={() => setScanning((current) => !current)}
                title="Read the barcode off the case with the camera"
                className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                  scanning ? 'border-blood-500 text-bone-100' : 'border-void-700 text-bone-300 hover:border-velvet-400'
                }`}
              >
                Scan
              </button>
            )}
          </form>

          {scanning && (
            <div className="mt-4">
              <BarcodeScanner onDetect={handleBarcode} onClose={() => setScanning(false)} />
            </div>
          )}

          {error && <p className="mt-3 text-sm text-blood-300">{error}</p>}
          {added && (
            <p className="mt-3 text-sm text-velvet-300">
              “{added}” is in the {label}.
            </p>
          )}

          {groups && total > 0 && (
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-bone-400">
              {groups.length} {groups.length === 1 ? 'album' : 'albums'}
              {films.length > 0 && `, ${films.length} ${films.length === 1 ? 'film' : 'films'}`}
              {' · '}
              {total} in all
            </p>
          )}

          <ul className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {groups?.map((group) => {
              const open = openGroup === group.key
              return (
                <li key={group.key} className="rounded-lg border border-void-700 bg-void-900/50">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <img
                      src={frontCoverUrl(group.pressings[0].id, 250)}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded border border-void-700 bg-void-800 object-cover"
                      onError={(event) => {
                        event.currentTarget.style.visibility = 'hidden'
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-bone-100">{group.title}</span>
                      <span className="block truncate text-xs text-bone-400">
                        {group.artist}
                        {group.year && ` · ${group.year}`}
                      </span>
                      <span className="block text-xs text-velvet-300">
                        {group.pressings.length}{' '}
                        {group.pressings.length === 1 ? 'pressing' : 'pressings'} — pick yours
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-bone-400">
                      {open ? '▾' : '▸'}
                    </span>
                  </button>

                  {open && (
                    <ul className="border-t border-void-800 p-2">
                      {group.pressings.map((pressing) => (
                        <li key={pressing.id}>
                          <button
                            type="button"
                            onClick={() => choose({ kind: 'release', release: pressing })}
                            className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                              chosen?.kind === 'release' && chosen.release.id === pressing.id
                                ? 'bg-velvet-900/50 text-bone-100'
                                : 'text-bone-400 hover:bg-void-800 hover:text-bone-200'
                            }`}
                          >
                            {pressingLine(pressing) || 'Details unknown'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}

            {films.map((film) => (
              <li key={film.id}>
                <button
                  type="button"
                  onClick={() => choose({ kind: 'film', film })}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    chosen?.kind === 'film' && chosen.film.id === film.id
                      ? 'border-velvet-400 bg-velvet-900/25'
                      : 'border-void-700 bg-void-900/50 hover:border-velvet-700'
                  }`}
                >
                  {film.posterUrl && (
                    <img
                      src={film.posterUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded border border-void-700 object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-bone-100">{film.title}</span>
                    <span className="block truncate text-xs text-bone-400">
                      {film.year} · Film
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* What you are about to add, in full, before anything is written. */}
        <aside className="rounded-lg border border-void-700 bg-void-950/60 p-4">
          {loadingPreview ? (
            <p className="text-sm text-bone-400">Fetching the details…</p>
          ) : !preview ? (
            <p className="text-sm text-bone-400">
              Pick a pressing and it will be shown here in full before anything is added.
            </p>
          ) : (
            <div className="space-y-3">
              {preview.coverImageUrl && (
                <img
                  src={preview.coverImageUrl}
                  alt=""
                  className="aspect-square w-full rounded-md border border-void-700 object-cover"
                />
              )}

              <div>
                <p className="font-display text-base leading-tight text-bone-100">
                  {preview.title}
                </p>
                <p className="text-sm text-bone-400">
                  {preview.artistOrDirector}
                  {preview.year ? ` · ${preview.year}` : ''}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {(
                  [
                    ['Format', preview.format],
                    ['Label', preview.label],
                    ['Catalogue', preview.catalogNumber],
                    ['Barcode', preview.barcode],
                    ['Pressed in', preview.country],
                    ['Genre', preview.genre],
                    ['Tracks', preview.trackList?.length ? String(preview.trackList.length) : ''],
                    ['Runtime', preview.runtimeMinutes ? `${preview.runtimeMinutes} min` : ''],
                  ] as [string, string | undefined][]
                )
                  .filter(([, value]) => Boolean(value))
                  .map(([name, value]) => (
                    <div key={name}>
                      <dt className="uppercase tracking-wide text-bone-400">{name}</dt>
                      <dd className="text-bone-200">{value}</dd>
                    </div>
                  ))}
              </dl>

              {duplicate && (
                <p className="rounded border border-blood-700 bg-blood-900/20 p-2 text-xs text-bone-200">
                  You already have this — {duplicate.reason}.{' '}
                  <Link
                    to={`/item/${duplicate.existing.id}`}
                    className="text-velvet-300 underline-offset-2 hover:underline"
                  >
                    Open the one you have
                  </Link>
                </p>
              )}

              <button
                type="button"
                onClick={confirm}
                disabled={adding}
                className="w-full rounded-md border border-blood-700 bg-blood-900/50 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400 disabled:opacity-50"
              >
                {adding
                  ? 'Adding…'
                  : duplicate
                    ? `Add to the ${label} anyway`
                    : `Add to the ${label}`}
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

