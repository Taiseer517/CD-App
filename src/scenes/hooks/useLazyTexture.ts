import { useEffect, useState } from 'react'
import { SRGBColorSpace, Texture, TextureLoader } from 'three'

// One loader and one cache for the whole scene: a shelf commonly shows the
// same sleeve twice (front of one case, background of the detail panel), and
// re-decoding a JPEG per mesh is wasted work.
const loader = new TextureLoader()
loader.setCrossOrigin('anonymous')
const cache = new Map<string, Promise<Texture>>()

function load(url: string): Promise<Texture> {
  const existing = cache.get(url)
  if (existing) return existing

  const pending = loader.loadAsync(url).then((texture) => {
    // Without this the artwork renders washed out — the loader defaults to
    // linear, but these are sRGB JPEGs.
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
  })

  cache.set(url, pending)
  // A failed load must not be cached as a permanent failure for the session.
  pending.catch(() => cache.delete(url))
  return pending
}

/**
 * Loads a texture without suspending, so a shelf of forty cases renders
 * immediately and the artwork arrives as it downloads rather than blocking
 * the whole scene behind one slow image.
 */
export function useLazyTexture(url: string | undefined): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }

    let active = true
    load(url)
      .then((loaded) => {
        if (active) setTexture(loaded)
      })
      .catch(() => {
        if (active) setTexture(null)
      })

    return () => {
      active = false
    }
  }, [url])

  return texture
}
