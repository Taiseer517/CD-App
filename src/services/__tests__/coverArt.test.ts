import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchArtwork, frontCoverUrl } from '../coverArt'

function respond(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('frontCoverUrl', () => {
  it('uses the stable direct pattern rather than a JSON round-trip', () => {
    expect(frontCoverUrl('abc')).toBe('https://coverartarchive.org/release/abc/front-500')
    expect(frontCoverUrl('abc', 1200)).toBe('https://coverartarchive.org/release/abc/front-1200')
  })
})

describe('fetchArtwork', () => {
  it('rewrites http image URLs, which are blocked as mixed content on https', async () => {
    vi.stubGlobal('fetch', () =>
      respond({
        images: [{ front: true, image: 'http://coverartarchive.org/release/x/1.jpg' }],
      }),
    )

    const art = await fetchArtwork('x')
    expect(art.front.startsWith('https://')).toBe(true)
  })

  it('prefers the 500px thumbnail over the full-size scan', async () => {
    vi.stubGlobal('fetch', () =>
      respond({
        images: [
          {
            front: true,
            image: 'http://coverartarchive.org/release/x/huge.jpg',
            thumbnails: { '500': 'http://coverartarchive.org/release/x/500.jpg' },
          },
        ],
      }),
    )

    expect((await fetchArtwork('x')).front).toContain('500.jpg')
  })

  it('separates front, back and disc scans', async () => {
    vi.stubGlobal('fetch', () =>
      respond({
        images: [
          { front: true, types: ['Front'], image: 'https://c/f.jpg' },
          { back: true, types: ['Back'], image: 'https://c/b.jpg' },
          { types: ['Medium'], image: 'https://c/d.jpg' },
        ],
      }),
    )

    const art = await fetchArtwork('x')
    expect(art).toEqual({ front: 'https://c/f.jpg', back: 'https://c/b.jpg', disc: 'https://c/d.jpg' })
  })

  it('falls back to any usable scan when none is tagged as the front', async () => {
    vi.stubGlobal('fetch', () =>
      respond({
        images: [
          { types: ['Booklet'], image: 'https://c/booklet.jpg' },
          { back: true, types: ['Back'], image: 'https://c/b.jpg' },
        ],
      }),
    )

    const art = await fetchArtwork('x')
    expect(art.front).toBe('https://c/booklet.jpg')
    expect(art.back).toBe('https://c/b.jpg')
  })

  it('treats a missing release as no artwork, not as a failure', async () => {
    vi.stubGlobal('fetch', () => respond(null, 404))

    await expect(fetchArtwork('x')).resolves.toEqual({ front: '', back: '', disc: '' })
  })

  it('raises anything that is not a 404', async () => {
    vi.stubGlobal('fetch', () => respond(null, 500))

    await expect(fetchArtwork('x')).rejects.toThrow(/500/)
  })
})
