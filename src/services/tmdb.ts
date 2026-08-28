import type { CollectionItemInput } from '../data/schema'
import { createThrottle } from './throttle'

const API = 'https://api.themoviedb.org/3'
const IMAGES = 'https://image.tmdb.org/t/p'

/**
 * The v3 key, as a query parameter rather than the v4 bearer token. A custom
 * Authorization header would make every request a CORS preflight, doubling the
 * round trips against a public read-only endpoint for no benefit.
 *
 * This is inlined into the published bundle — unavoidable, since the requests
 * are made from the browser. That is acceptable here and nowhere else: a TMDB
 * read key is rate-limited rather than dangerous, TMDB permits client-side
 * use, and it can be rotated from the account at any time. It is kept out of
 * git all the same, so it never enters the history.
 */
const KEY = import.meta.env.VITE_TMDB_KEY ?? ''

/** TMDB allows far more than MusicBrainz; this is politeness, not a limit. */
const throttle = createThrottle(120)

export function isTmdbConfigured(): boolean {
  return KEY.length > 0
}

/** Attribution is a condition of using the API, not a courtesy. */
export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.'

export interface FilmSummary {
  id: number
  title: string
  director: string
  year: string
  overview: string
  posterUrl: string
}

interface RawFilm {
  id: number
  title?: string
  release_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  runtime?: number | null
  imdb_id?: string | null
  genres?: { name?: string }[]
  credits?: {
    crew?: { job?: string; name?: string }[]
    cast?: { name?: string }[]
  }
}

function imageUrl(path: string | null | undefined, size: 'w500' | 'w780' | 'original'): string {
  return path ? `${IMAGES}/${size}${path}` : ''
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!KEY) throw new Error('No TMDB key is configured.')

  const query = new URLSearchParams({ api_key: KEY, ...params })
  const response = await throttle(() =>
    fetch(`${API}${path}?${query}`, { headers: { Accept: 'application/json' } }),
  )

  if (response.status === 401) throw new Error('The TMDB key was rejected.')
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`)
  return response.json() as Promise<T>
}

function directorOf(film: RawFilm): string {
  const crew = film.credits?.crew ?? []
  return crew.find((member) => member.job === 'Director')?.name ?? ''
}

export async function searchFilms(query: string): Promise<FilmSummary[]> {
  const trimmed = query.trim()
  if (!trimmed || !KEY) return []

  const data = await request<{ results?: RawFilm[] }>('/search/movie', { query: trimmed })

  return (data.results ?? []).slice(0, 12).map((film) => ({
    id: film.id,
    title: film.title ?? '',
    // The search endpoint carries no crew; the director arrives with getFilm.
    director: '',
    year: (film.release_date ?? '').slice(0, 4),
    overview: film.overview ?? '',
    posterUrl: imageUrl(film.poster_path, 'w500'),
  }))
}

/**
 * Maps a film onto the fields the collection owns. Partial, and deliberately
 * silent about rating, notes, condition and date acquired — those are hers to
 * write, and filling them with anything at all would be inventing.
 */
export async function getFilm(id: number): Promise<Partial<CollectionItemInput>> {
  const film = await request<RawFilm>(`/movie/${id}`, { append_to_response: 'credits' })

  const patch: Partial<CollectionItemInput> = {
    type: 'dvd',
    title: film.title ?? '',
    artistOrDirector: directorOf(film),
    tmdbId: String(film.id),
    sourceName: 'TMDB',
    sourceUrl: `https://www.themoviedb.org/movie/${film.id}`,
  }

  // Every field below is written only when TMDB actually returned it, so a
  // sparse record stays blank rather than acquiring a plausible-looking guess.
  const year = Number.parseInt((film.release_date ?? '').slice(0, 4), 10)
  if (Number.isFinite(year)) patch.year = year

  const genre = film.genres?.find((entry) => entry.name)?.name
  if (genre) patch.genre = genre

  if (film.overview) patch.synopsis = film.overview

  const poster = imageUrl(film.poster_path, 'w500')
  if (poster) patch.coverImageUrl = poster

  const backdrop = imageUrl(film.backdrop_path, 'w780')
  if (backdrop || poster) patch.backgroundImageUrl = backdrop || poster

  if (film.runtime) patch.runtimeMinutes = film.runtime

  const cast = (film.credits?.cast ?? []).map((member) => member.name).filter(Boolean)
  if (cast.length > 0) patch.cast = cast.slice(0, 8) as string[]

  return patch
}
