import type { CollectionItem, CollectionItemInput } from './schema'

/**
 * Whether the archive already holds this record.
 *
 * Ranked by how sure the match is. A barcode identifies one pressing
 * exactly; a MusicBrainz id the same. Title and artist together are only a
 * likelihood — the same album exists as a dozen pressings and she may
 * deliberately own two — so that case warns rather than blocks.
 */
export type DuplicateConfidence = 'exact' | 'likely'

export interface DuplicateMatch {
  existing: CollectionItem
  confidence: DuplicateConfidence
  reason: string
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Whatever of a candidate record is known so far; all of it optional. */
export type DuplicateCandidate = Partial<
  Pick<CollectionItemInput, 'barcode' | 'musicbrainzId' | 'tmdbId' | 'title' | 'artistOrDirector'>
>

export function findDuplicate(
  candidate: DuplicateCandidate,
  collection: CollectionItem[],
): DuplicateMatch | null {
  const barcode = candidate.barcode?.trim()
  if (barcode) {
    const hit = collection.find((item) => item.barcode.trim() === barcode)
    if (hit) return { existing: hit, confidence: 'exact', reason: 'the same barcode' }
  }

  if (candidate.musicbrainzId) {
    const hit = collection.find((item) => item.musicbrainzId === candidate.musicbrainzId)
    if (hit) return { existing: hit, confidence: 'exact', reason: 'the same pressing' }
  }

  if (candidate.tmdbId) {
    const hit = collection.find((item) => item.tmdbId === candidate.tmdbId)
    if (hit) return { existing: hit, confidence: 'exact', reason: 'the same film' }
  }

  const title = normalise(candidate.title ?? '')
  const artist = normalise(candidate.artistOrDirector ?? '')
  if (title) {
    const hit = collection.find(
      (item) => normalise(item.title) === title && normalise(item.artistOrDirector) === artist,
    )
    // Deliberately not exact: two pressings of one album are a real thing to
    // own, so this is worth saying and not worth refusing.
    if (hit) return { existing: hit, confidence: 'likely', reason: 'the same title and artist' }
  }

  return null
}
