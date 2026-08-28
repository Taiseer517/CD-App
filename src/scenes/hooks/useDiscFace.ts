import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

/**
 * Builds the face of a disc: the album art printed edge to edge, with the
 * character of the medium laid over the top.
 *
 * Earlier this pasted a small label into the middle of a generic silver ring,
 * which is not what either object looks like. A picture disc carries its
 * artwork across the whole surface, and a printed CD is the same — so the art
 * is the base layer here, and the diffraction, grooves and sheen are composited
 * on top of it rather than instead of it.
 *
 * The spindle hole is punched out as real transparency, so you see through the
 * disc to whatever is behind it, exactly as you would holding one up.
 */
const SIZE = 1024

type DiscKind = 'cd' | 'vinyl'

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/** Draws a square image centre-cropped to fill the disc's circle. */
function paintArtwork(ctx: CanvasRenderingContext2D, image: HTMLImageElement, size: number) {
  const source = Math.min(image.naturalWidth, image.naturalHeight)
  const sx = (image.naturalWidth - source) / 2
  const sy = (image.naturalHeight - source) / 2
  ctx.drawImage(image, sx, sy, source, source, 0, 0, size, size)
}

function paintFallback(ctx: CanvasRenderingContext2D, size: number, kind: DiscKind) {
  const centre = size / 2
  if (kind === 'vinyl') {
    ctx.fillStyle = '#0a0a0d'
    ctx.fillRect(0, 0, size, size)
    return
  }
  const silver = ctx.createRadialGradient(centre, centre, size * 0.1, centre, centre, centre)
  silver.addColorStop(0, '#3a3a46')
  silver.addColorStop(0.6, '#9aa0b2')
  silver.addColorStop(1, '#5c6072')
  ctx.fillStyle = silver
  ctx.fillRect(0, 0, size, size)
}

/** The rainbow a CD throws, laid over the print rather than replacing it. */
function overlayDiffraction(ctx: CanvasRenderingContext2D, size: number) {
  const centre = size / 2

  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.5

  const spectrum = ctx.createConicGradient(0.6, centre, centre)
  const stops = [
    '#7fd8ff', '#b9a6ff', '#ff9ad5', '#ffd39a', '#b6ffb0',
    '#7fd8ff', '#b9a6ff', '#ff9ad5', '#ffd39a', '#b6ffb0', '#7fd8ff',
  ]
  stops.forEach((colour, index) => spectrum.addColorStop(index / (stops.length - 1), colour))
  ctx.fillStyle = spectrum
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  // A bright sweep across one side, as though a single lamp is on it.
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const sweep = ctx.createLinearGradient(0, size, size, 0)
  sweep.addColorStop(0, 'rgba(255,255,255,0)')
  sweep.addColorStop(0.42, 'rgba(255,255,255,0.22)')
  sweep.addColorStop(0.58, 'rgba(255,255,255,0.05)')
  sweep.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sweep
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  // Fine track rings, only across the data area.
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.lineWidth = 1
  for (let radius = centre * 0.24; radius < centre * 0.995; radius += 2.5) {
    ctx.strokeStyle = radius % 5 < 2.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
    ctx.beginPath()
    ctx.arc(centre, centre, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** Grooves cut through the print on a picture disc, so they darken it. */
function overlayGrooves(ctx: CanvasRenderingContext2D, size: number) {
  const centre = size / 2

  // Darken the print first. A picture disc is artwork seen through black
  // vinyl, so it reads muted rather than at full poster strength.
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = 'rgba(132,136,160,0.62)'
  ctx.beginPath()
  ctx.arc(centre, centre, centre, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Then cut the grooves *over* the darkened print — drawn underneath it they
  // were simply washed away, which is why the record read as a flat picture.
  ctx.save()
  ctx.lineWidth = 1.5
  for (let radius = centre * 0.3; radius < centre * 0.985; radius += 3.6) {
    // A wider dark gap every so often reads as the band between tracks.
    const band = Math.round(radius / 3.6) % 22 === 0
    ctx.strokeStyle = band ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.arc(centre, centre, radius, 0, Math.PI * 2)
    ctx.stroke()

    // The lit edge of each groove wall, which is what makes them read.
    ctx.strokeStyle = 'rgba(232,238,255,0.16)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(centre, centre, radius + 1.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 1.5
  }
  ctx.restore()

  // A single broad sheen across one side, the way a record catches a lamp.
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const sheen = ctx.createLinearGradient(size * 0.1, 0, size * 0.9, size)
  sheen.addColorStop(0, 'rgba(158,172,214,0.26)')
  sheen.addColorStop(0.38, 'rgba(255,255,255,0.03)')
  sheen.addColorStop(0.66, 'rgba(150,160,196,0.14)')
  sheen.addColorStop(1, 'rgba(110,120,160,0.02)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, size, size)
  ctx.restore()
}

function compose(image: HTMLImageElement | null, kind: DiscKind): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const centre = SIZE / 2

  // Everything is drawn inside the disc's circle; outside it stays clear, so
  // the mesh reads as a disc rather than a square with a disc on it.
  ctx.save()
  ctx.beginPath()
  ctx.arc(centre, centre, centre, 0, Math.PI * 2)
  ctx.clip()

  if (image) paintArtwork(ctx, image, SIZE)
  else paintFallback(ctx, SIZE, kind)

  if (kind === 'vinyl') overlayGrooves(ctx, SIZE)
  else overlayDiffraction(ctx, SIZE)

  ctx.restore()

  // The label area: on a record the print is flat and ungrooved here, and on
  // a CD the mirrored ring stops. Lift it so the artwork reads cleanly.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(centre, centre, centre * (kind === 'vinyl' ? 0.1 : 0.075), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // The clear plastic collar around the spindle on a CD.
  if (kind === 'cd') {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = SIZE * 0.028
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.arc(centre, centre, centre * 0.118, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/**
 * The printed face of a disc. Prefers a scan of the disc itself when one
 * exists, and otherwise prints the sleeve across it, which is what a picture
 * disc does.
 */
export function useDiscFace(artworkUrl: string | undefined, kind: DiscKind): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    let active = true
    let created: Texture | null = null

    void (async () => {
      const image = artworkUrl ? await loadImage(artworkUrl) : null
      if (!active) return
      created = compose(image, kind)
      setTexture(created)
    })()

    return () => {
      active = false
      created?.dispose()
    }
  }, [artworkUrl, kind])

  return texture
}
