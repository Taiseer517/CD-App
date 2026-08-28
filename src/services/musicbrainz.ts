import type { CollectionItemInput, MediaType, Track } from '../data/schema'
import { createThrottle } from './throttle'

const API = 'https://musicbrainz.org/ws/2'

// One request per second, per the MusicBrainz rate limit. Note that the
// User-Agent they ask for cannot be set from a browser — fetch treats it as a
// forbidden header — so the browser's own agent is sent and the throttle is
// what actually keeps us within the policy.
const throttle = createThrottle(1100)

export interface ReleaseSummary {
  id: string
  title: string
  artist: string
  date: string
  country: string
  label: string
  catalogNumber: string
  format: string
  trackCount: number
  barcode: string
}

interface RawLabelInfo {
  label?: { name?: string }
  'catalog-number'?: string
}

interface RawMedium {
  format?: string
  'track-count'?: number
  tracks?: { position?: number; title?: string; length?: number | null }[]
}

interface RawRelease {
  id: string
  title?: string
  date?: string
  country?: string
  barcode?: string | null
  'artist-credit'?: { name?: string; joinphrase?: string }[]
  'label-info'?: RawLabelInfo[]
  media?: RawMedium[]
  genres?: { name?: string; count?: number }[]
}

function creditedArtist(release: RawRelease): string {
  const credits = release['artist-credit'] ?? []
  return credits.map((credit) => `${credit.name ?? ''}${credit.joinphrase ?? ''}`).join('').trim()
}

function firstLabel(release: RawRelease): { label: string; catalogNumber: string } {
  const info = (release['label-info'] ?? [])[0]
  return {
    label: info?.label?.name ?? '',
    catalogNumber: info?.['catalog-number'] ?? '',
  }
}

function mediaFormat(release: RawRelease): string {
  const media = release.media ?? []
  if (media.length === 0) return ''
  const format = media[0].format ?? ''
  // "2×CD" reads better on a shelf label than "CD" when there are two discs.
  return media.length > 1 ? `${media.length}×${format}` : format
}

/** MusicBrainz reports genres lowercase; shelves read better in title case. */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

/** Raised when the service is unavailable, as against having found nothing. */
export class ServiceBusyError extends Error {
  constructor() {
    super('MusicBrainz is busy right now.')
    this.name = 'ServiceBusyError'
  }
}

// Measured against the live service: a busy spell routinely swallows two
// attempts in a row, so three retries is not enough headroom. Five tries over
// about twelve seconds is still better than telling her a record she owns
// does not exist.
const RETRY_DELAYS_MS = [800, 1600, 3200, 6000]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * MusicBrainz answers a good share of requests with 503 "server busy" — not
 * because we are over the rate limit, but because the public instance is
 * genuinely loaded. Without a retry those come back as "nothing matched",
 * which is the wrong thing to tell someone whose record does exist.
 */
async function request<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await throttle(() => fetch(url, { headers: { Accept: 'application/json' } }))

    if (response.ok) return response.json() as Promise<T>

    if (response.status === 503 && attempt < RETRY_DELAYS_MS.length) {
      await wait(RETRY_DELAYS_MS[attempt])
      continue
    }
    if (response.status === 503) throw new ServiceBusyError()

    throw new Error(`MusicBrainz returned ${response.status}`)
  }
}

function toSummary(release: RawRelease): ReleaseSummary {
  const { label, catalogNumber } = firstLabel(release)
  return {
    id: release.id,
    title: release.title ?? '',
    artist: creditedArtist(release),
    date: release.date ?? '',
    country: release.country ?? '',
    label,
    catalogNumber,
    format: mediaFormat(release),
    trackCount: (release.media ?? []).reduce((sum, m) => sum + (m['track-count'] ?? 0), 0),
    barcode: release.barcode ?? '',
  }
}

/**
 * Maps a full release into the fields the form owns. Deliberately partial:
 * it never touches rating, notes, condition or tags, which are hers.
 */
export function mapReleaseToPatch(release: RawRelease): Partial<CollectionItemInput> {
  const { label, catalogNumber } = firstLabel(release)
  const format = mediaFormat(release)
  const year = Number.parseInt((release.date ?? '').slice(0, 4), 10)

  const tracks: Track[] = []
  for (const medium of release.media ?? []) {
    for (const track of medium.tracks ?? []) {
      tracks.push({
        position: track.position ?? tracks.length + 1,
        title: track.title ?? '',
        lengthMs: typeof track.length === 'number' ? track.length : null,
      })
    }
  }

  const topGenre = [...(release.genres ?? [])]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .find((genre) => genre.name)

  const patch: Partial<CollectionItemInput> = {
    title: release.title ?? '',
    artistOrDirector: creditedArtist(release),
    label,
    catalogNumber,
    barcode: release.barcode ?? '',
    country: release.country ?? '',
    format,
    musicbrainzId: release.id,
    trackList: tracks,
  }

  // Only overwrite year and genre when the lookup actually knows them, so a
  // sparse release can't blank out something already filled in by hand.
  if (Number.isFinite(year)) patch.year = year
  if (topGenre?.name) patch.genre = titleCase(topGenre.name)
  const type = formatToMediaType(format)
  if (type) patch.type = type

  return patch
}

export function formatToMediaType(format: string): MediaType | null {
  const normalised = format.toLowerCase()
  if (normalised.includes('vinyl') || normalised.includes('lp') || /\d+"/.test(normalised)) {
    return 'vinyl'
  }
  if (normalised.includes('dvd') || normalised.includes('blu')) return 'dvd'
  if (normalised.includes('cd')) return 'cd'
  return null
}

/**
 * Free-text search for the case where she knows what she is hunting for but
 * not which half is the artist.
 *
 * MusicBrainz ranks "Dead Can Dance Aion" with the self-titled album first,
 * because three of the four words match its title outright. Results are
 * therefore re-ranked here on how much of what she typed each one actually
 * accounts for — the record called Aion by Dead Can Dance explains every word,
 * the self-titled album leaves one stranded.
 */
export async function searchAlbums(freeText: string): Promise<ReleaseSummary[]> {
  const trimmed = freeText.trim()
  if (!trimmed) return []

  // A hundred candidates rather than forty: a common word like "kisses" can
  // match tens of thousands of releases, and the one she means has to be in
  // the pool before the re-ranking below can lift it to the top.
  const url = `${API}/release/?query=${encodeURIComponent(trimmed)}&fmt=json&limit=100`
  const data = await request<{ releases?: RawRelease[] }>(url)

  const terms = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1)

  const summaries = (data.releases ?? []).map((release) => {
    const summary = toSummary(release)
    const haystack = `${summary.title} ${summary.artist}`.toLowerCase()
    // Prefix rather than exact match, so "Bloody Kiss" still finds
    // "Bloody Kisses" and a half-remembered title is not a dead end.
    const covered = terms.filter((term) =>
      haystack.split(/\s+/).some((word) => word.startsWith(term)),
    ).length

    return {
      summary,
      coverage: terms.length === 0 ? 1 : covered / terms.length,
      // A release with a known date and country is a real pressing someone
      // catalogued properly, rather than a bare stub.
      completeness: (release.date ? 1 : 0) + (release.country ? 1 : 0),
    }
  })

  return summaries
    .sort((a, b) => b.coverage - a.coverage || b.completeness - a.completeness)
    .map((entry) => entry.summary)
    .slice(0, 14)
}

export async function getRelease(mbid: string): Promise<Partial<CollectionItemInput>> {
  const url = `${API}/release/${mbid}?inc=artist-credits+labels+recordings+genres&fmt=json`
  return mapReleaseToPatch(await request<RawRelease>(url))
}
