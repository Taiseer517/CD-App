import type { CollectionItemInput } from '../data/schema'
import { fetchArtwork } from './coverArt'
import { extractDominantColor } from './dominantColor'
import { getRelease } from './musicbrainz'
import { getFilm } from './tmdb'

/**
 * Everything the sources know about one record, gathered in one place.
 *
 * This used to be written out three times over — once for adding a record,
 * once for the lookup on the edit form, once for refreshing an existing row —
 * and the three had drifted apart. Refreshing never re-sampled the cover's
 * colour; the edit form could not look up a film at all. Whichever way a
 * record enters the archive, it should arrive knowing the same amount about
 * itself, so there is one path and every entry point takes it.
 *
 * Nothing here invents. A field the source did not return is simply absent
 * from the patch, so it keeps whatever it already had rather than being
 * overwritten with a blank.
 */

export async function enrichRelease(mbid: string): Promise<Partial<CollectionItemInput>> {
  const patch = await getRelease(mbid)

  const artwork = await fetchArtwork(mbid)
  if (artwork.front) {
    patch.coverImageUrl = artwork.front
    patch.backgroundImageUrl = artwork.back || artwork.front
  }
  if (artwork.back) patch.backCoverImageUrl = artwork.back
  if (artwork.disc) patch.discImageUrl = artwork.disc

  // Sampling needs the image decoded, so it goes last and is allowed to come
  // back empty without holding up everything else.
  if (patch.coverImageUrl) {
    const colour = await extractDominantColor(patch.coverImageUrl)
    if (colour) patch.dominantColor = colour
  }

  return patch
}

export async function enrichFilm(tmdbId: number): Promise<Partial<CollectionItemInput>> {
  const patch = await getFilm(tmdbId)

  if (patch.coverImageUrl) {
    const colour = await extractDominantColor(patch.coverImageUrl)
    if (colour) patch.dominantColor = colour
  }

  return patch
}
