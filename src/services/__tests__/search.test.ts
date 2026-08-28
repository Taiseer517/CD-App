import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchAlbums, ServiceBusyError } from '../musicbrainz'

function release(title: string, artist: string, extra: Record<string, unknown> = {}) {
  return {
    id: `mbid-${title}-${artist}`.replace(/\s+/g, '-'),
    title,
    'artist-credit': [{ name: artist }],
    date: '1993',
    country: 'US',
    media: [{ format: 'CD', 'track-count': 10 }],
    ...extra,
  }
}

function ok(releases: unknown[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ releases }),
  } as Response)
}

function busy() {
  return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('searchAlbums ranking', () => {
  it('finds a record from a partial title, which exact matching could not', async () => {
    // The precise case that failed: "Bloody Kiss" against "Bloody Kisses".
    vi.stubGlobal('fetch', () =>
      ok([
        release('Bloody Kisses', 'Two Witches'),
        release('Bloody Kisses', 'Type O Negative'),
      ]),
    )

    const found = await searchAlbums('Bloody Kiss Type O Negative')
    expect(found[0].title).toBe('Bloody Kisses')
    expect(found[0].artist).toBe('Type O Negative')
  })

  it('tolerates a missing leading article in the artist name', async () => {
    vi.stubGlobal('fetch', () =>
      ok([release('Some Other Record', 'Nobody'), release('Floodland', 'The Sisters of Mercy')]),
    )

    const found = await searchAlbums('Floodland Sisters of Mercy')
    expect(found[0].artist).toBe('The Sisters of Mercy')
  })

  it('ranks the record that explains every word above one that explains most', async () => {
    vi.stubGlobal('fetch', () =>
      ok([release('Dead Can Dance', 'Dead Can Dance'), release('Aion', 'Dead Can Dance')]),
    )

    const found = await searchAlbums('Dead Can Dance Aion')
    expect(found[0].title).toBe('Aion')
  })

  it('prefers a pressing with a known date and country over a bare stub', async () => {
    vi.stubGlobal('fetch', () =>
      ok([
        release('Floodland', 'The Sisters of Mercy', { date: undefined, country: undefined }),
        release('Floodland', 'The Sisters of Mercy'),
      ]),
    )

    const found = await searchAlbums('Floodland')
    expect(found[0].date).toBe('1993')
  })

  it('returns nothing for an empty query without calling the service', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await searchAlbums('   ')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('service availability', () => {
  it('retries a busy response rather than reporting nothing found', async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(busy)
      .mockImplementationOnce(busy)
      .mockImplementationOnce(() => ok([release('Draconian Times', 'Paradise Lost')]))
    vi.stubGlobal('fetch', fetchSpy)

    const found = await searchAlbums('Draconian Times')

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(found[0].title).toBe('Draconian Times')
  }, 20000)

  it('raises a distinct error when the service stays busy', async () => {
    vi.stubGlobal('fetch', busy)

    // Telling her "nothing matched" when the service is down sends her looking
    // for a spelling mistake that is not there.
    await expect(searchAlbums('Draconian Times')).rejects.toBeInstanceOf(ServiceBusyError)
  }, 30000)
})
