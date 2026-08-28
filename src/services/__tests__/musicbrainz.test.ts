import { describe, expect, it } from 'vitest'
import { formatToMediaType, mapReleaseToPatch } from '../musicbrainz'

// Trimmed from the real response for the US 1993 pressing of Bloody Kisses.
const bloodyKisses = {
  id: 'a98c1d5d-263d-43e6-8926-7d06def614ba',
  title: 'Bloody Kisses',
  date: '1993-08-17',
  country: 'US',
  barcode: '016861910020',
  'artist-credit': [{ name: 'Type O Negative' }],
  'label-info': [{ label: { name: 'Roadrunner Records' }, 'catalog-number': 'RR 9100-2' }],
  genres: [{ name: 'gothic metal', count: 7 }, { name: 'doom metal', count: 2 }],
  media: [
    {
      format: 'CD',
      'track-count': 2,
      tracks: [
        { position: 1, title: 'Machine Screw', length: 40826 },
        { position: 2, title: 'Christian Woman', length: 538133 },
      ],
    },
  ],
}

describe('mapReleaseToPatch', () => {
  it('pulls the pressing details a collector actually cares about', () => {
    const patch = mapReleaseToPatch(bloodyKisses)

    expect(patch.title).toBe('Bloody Kisses')
    expect(patch.artistOrDirector).toBe('Type O Negative')
    expect(patch.year).toBe(1993)
    expect(patch.label).toBe('Roadrunner Records')
    expect(patch.catalogNumber).toBe('RR 9100-2')
    expect(patch.barcode).toBe('016861910020')
    expect(patch.country).toBe('US')
    expect(patch.musicbrainzId).toBe('a98c1d5d-263d-43e6-8926-7d06def614ba')
  })

  it('title-cases the genre, which MusicBrainz reports lowercase', () => {
    expect(mapReleaseToPatch(bloodyKisses).genre).toBe('Gothic Metal')
  })

  it('picks the most-voted genre rather than the first listed', () => {
    const reordered = {
      ...bloodyKisses,
      genres: [{ name: 'doom metal', count: 2 }, { name: 'gothic metal', count: 7 }],
    }
    expect(mapReleaseToPatch(reordered).genre).toBe('Gothic Metal')
  })

  it('flattens tracks across discs and keeps their lengths', () => {
    const patch = mapReleaseToPatch(bloodyKisses)
    expect(patch.trackList).toHaveLength(2)
    expect(patch.trackList?.[1]).toEqual({
      position: 2,
      title: 'Christian Woman',
      lengthMs: 538133,
      disc: 1,
    })
  })

  it('records which disc a track sits on, since numbering restarts per disc', () => {
    const double = {
      ...bloodyKisses,
      media: [
        { format: 'CD', tracks: [{ position: 1, title: 'Opening', length: 1000 }] },
        { format: 'CD', tracks: [{ position: 1, title: 'Second disc, first track', length: 2000 }] },
      ],
    }

    const tracks = mapReleaseToPatch(double).trackList ?? []
    // Both are "track 1"; only the disc number tells them apart, and without
    // it a two-disc tracklist reads as though it restarts by mistake.
    expect(tracks.map((track) => [track.disc, track.position])).toEqual([
      [1, 1],
      [2, 1],
    ])
  })

  it('labels a multi-disc set by its disc count', () => {
    const double = {
      ...bloodyKisses,
      media: [{ format: 'CD', tracks: [] }, { format: 'CD', tracks: [] }],
    }
    expect(mapReleaseToPatch(double).format).toBe('2×CD')
  })

  it('leaves year and genre untouched when the release does not know them', () => {
    const sparse = { id: 'x', title: 'Unknown Pressing', media: [] }
    const patch = mapReleaseToPatch(sparse)

    expect(patch).not.toHaveProperty('year')
    expect(patch).not.toHaveProperty('genre')
  })

  it('never overwrites the fields that are hers to write', () => {
    const patch = mapReleaseToPatch(bloodyKisses)

    for (const field of ['rating', 'notes', 'conditionOrEdition', 'tags', 'wishlist', 'dateAcquired']) {
      expect(patch).not.toHaveProperty(field)
    }
  })

  it('handles a collaboration credit with its join phrase', () => {
    const split = {
      ...bloodyKisses,
      'artist-credit': [
        { name: 'Dead Can Dance', joinphrase: ' & ' },
        { name: 'Lisa Gerrard' },
      ],
    }
    expect(mapReleaseToPatch(split).artistOrDirector).toBe('Dead Can Dance & Lisa Gerrard')
  })
})

describe('formatToMediaType', () => {
  it.each([
    ['CD', 'cd'],
    ['2×CD', 'cd'],
    ['12" Vinyl', 'vinyl'],
    ['Vinyl', 'vinyl'],
    ['LP', 'vinyl'],
    ['DVD-Video', 'dvd'],
    ['Blu-ray', 'dvd'],
  ])('reads %s as %s', (format, expected) => {
    expect(formatToMediaType(format)).toBe(expected)
  })

  it('returns null for a format it cannot place, leaving the choice alone', () => {
    expect(formatToMediaType('Cassette')).toBeNull()
    expect(formatToMediaType('')).toBeNull()
  })
})
