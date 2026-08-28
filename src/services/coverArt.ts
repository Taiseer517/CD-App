import { createThrottle } from './throttle'

const CAA = 'https://coverartarchive.org'
const throttle = createThrottle(400)

export interface Artwork {
  front: string
  back: string
  disc: string
}

interface RawImage {
  image?: string
  front?: boolean
  back?: boolean
  types?: string[]
  thumbnails?: Record<string, string>
}

/**
 * The Cover Art Archive serves its JSON with http:// image URLs. The app is
 * served over https on Pages, where those are blocked as mixed content, so
 * every URL is rewritten on the way through.
 */
function secure(url: string | undefined): string {
  if (!url) return ''
  return url.replace(/^http:\/\//i, 'https://')
}

/** The stable direct pattern — no JSON round-trip needed just for a front cover. */
export function frontCoverUrl(mbid: string, size: 250 | 500 | 1200 = 500): string {
  return `${CAA}/release/${mbid}/front-${size}`
}

function pickThumbnail(image: RawImage, size: '500' | '250' | '1200'): string {
  return secure(image.thumbnails?.[size] ?? image.image)
}

export async function fetchArtwork(mbid: string): Promise<Artwork> {
  const response = await throttle(() => fetch(`${CAA}/release/${mbid}`, {
    headers: { Accept: 'application/json' },
  }))

  // 404 simply means nobody has uploaded art for this pressing yet, which is
  // common for obscure European metal presses and is not an error.
  if (response.status === 404) return { front: '', back: '', disc: '' }
  if (!response.ok) throw new Error(`Cover Art Archive returned ${response.status}`)

  const data = (await response.json()) as { images?: RawImage[] }
  const images = data.images ?? []

  const back = images.find((image) => image.back) ?? images.find((i) => i.types?.includes('Back'))
  const disc = images.find((image) => image.types?.includes('Medium'))

  // Some releases have scans but none tagged Front. Falling back to the first
  // image that is not the back or the disc beats showing no sleeve at all.
  const front =
    images.find((image) => image.front) ??
    images.find((image) => image.types?.includes('Front')) ??
    images.find((image) => image !== back && image !== disc)

  return {
    front: front ? pickThumbnail(front, '500') : '',
    back: back ? pickThumbnail(back, '500') : '',
    disc: disc ? pickThumbnail(disc, '500') : '',
  }
}
