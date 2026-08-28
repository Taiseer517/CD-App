import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

/**
 * Loads cover art for the shelf, downscaled and reference-counted.
 *
 * A collection of several hundred records is the case that matters here. At
 * full 500px each, their sleeves alone would run to hundreds of megabytes of
 * GPU memory, so every texture is resampled to at most SHELF_TEXTURE_SIZE —
 * far more than a case a couple of hundred pixels tall can show. The detail
 * pages use ordinary <img> tags and still get the full-resolution scan.
 */
const SHELF_TEXTURE_SIZE = 320

/** Textures kept loaded beyond those currently on screen. */
const CACHE_LIMIT = 80

interface Entry {
  promise: Promise<Texture | null>
  texture: Texture | null
  /** How many mounted cases are currently showing this image. */
  refs: number
  lastUsed: number
}

const cache = new Map<string, Entry>()

function resample(image: HTMLImageElement): Texture | null {
  const longest = Math.max(image.naturalWidth, image.naturalHeight) || SHELF_TEXTURE_SIZE
  const scale = Math.min(1, SHELF_TEXTURE_SIZE / longest)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Drops the least recently used textures that nothing is currently showing. */
function evict() {
  if (cache.size <= CACHE_LIMIT) return

  const idle = [...cache.entries()]
    .filter(([, entry]) => entry.refs === 0 && entry.texture)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed)

  for (const [url, entry] of idle) {
    if (cache.size <= CACHE_LIMIT) break
    entry.texture?.dispose()
    cache.delete(url)
  }
}

function acquire(url: string): Entry {
  const existing = cache.get(url)
  if (existing) {
    existing.refs += 1
    existing.lastUsed = Date.now()
    return existing
  }

  const entry: Entry = {
    refs: 1,
    texture: null,
    lastUsed: Date.now(),
    promise: new Promise<Texture | null>((resolve) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(resample(image))
      image.onerror = () => resolve(null)
      image.src = url
    }),
  }

  entry.promise.then((texture) => {
    entry.texture = texture
    // The image may have finished after every case using it was unmounted.
    if (entry.refs === 0) evict()
  })

  cache.set(url, entry)
  return entry
}

function release(url: string) {
  const entry = cache.get(url)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  entry.lastUsed = Date.now()
  evict()
}

/**
 * Loads a texture without suspending, so a shelf renders immediately and the
 * artwork arrives as it downloads rather than blocking the whole scene behind
 * one slow image.
 */
export function useLazyTexture(url: string | undefined): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }

    let active = true
    const entry = acquire(url)

    entry.promise.then((loaded) => {
      if (active) setTexture(loaded)
    })

    return () => {
      active = false
      release(url)
    }
  }, [url])

  return texture
}

/** Test and diagnostic hook: how many textures are resident right now. */
export function textureCacheSize(): number {
  return cache.size
}
