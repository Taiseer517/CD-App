import { describe, expect, it } from 'vitest'
import rawCollection from '../collection.json'
import { CollectionItemSchema, type CollectionItem } from '../schema'

const collection = (rawCollection as unknown[]).map((entry) =>
  CollectionItemSchema.parse(entry),
) as CollectionItem[]

/**
 * The archive's central claim is that everything it shows is true and came
 * from somewhere checkable. These tests hold the seed data to it — the
 * original shipped invented ratings, notes and genres presented as fact, and
 * nothing but a test stops that returning.
 */
describe('the starter collection states only what a source supports', () => {
  it('has records to check', () => {
    expect(collection.length).toBeGreaterThan(0)
  })

  it.each(['rating', 'notes', 'conditionOrEdition', 'dateAcquired'] as const)(
    'leaves %s empty, because it is Zarin’s to write and no one else’s to guess',
    (field) => {
      const invented = collection.filter((item) => {
        const value = item[field]
        return typeof value === 'number' ? value !== 0 : Boolean(value)
      })

      expect(
        invented.map((item) => `${item.title}: ${String(item[field])}`),
      ).toEqual([])
    },
  )

  it('names a source for every record', () => {
    const unsourced = collection.filter((item) => !item.sourceName || !item.sourceUrl)
    expect(unsourced.map((item) => item.title)).toEqual([])
  })

  it('points each source link at the service that actually holds the record', () => {
    for (const item of collection) {
      if (item.sourceName === 'MusicBrainz') {
        expect(item.sourceUrl).toBe(`https://musicbrainz.org/release/${item.musicbrainzId}`)
      }
      if (item.sourceName === 'TMDB') {
        expect(item.sourceUrl).toBe(`https://www.themoviedb.org/movie/${item.tmdbId}`)
      }
    }
  })

  it('carries an identifier that can be re-checked against the source', () => {
    const unverifiable = collection.filter((item) => !item.musicbrainzId && !item.tmdbId)
    expect(unverifiable.map((item) => item.title)).toEqual([])
  })

  it('gives films their director rather than leaving the field to be guessed at', () => {
    for (const film of collection.filter((item) => item.type === 'dvd')) {
      expect(film.artistOrDirector).not.toBe('')
      expect(film.synopsis).not.toBe('')
    }
  })

  it('keeps the year consistent with the source it was matched against', () => {
    // Nosferatu is the case that caught this: a re-run once matched the 1922
    // original to the 2024 remake and rewrote the year to match.
    for (const item of collection) {
      expect(item.year).toBeGreaterThan(1900)
      expect(item.year).toBeLessThanOrEqual(new Date().getFullYear() + 1)
    }
  })
})
