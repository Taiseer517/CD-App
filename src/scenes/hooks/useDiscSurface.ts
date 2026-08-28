import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

/**
 * Paints the read side of a disc: the spiral rainbow, the fine track rings,
 * and the darkening toward the rim.
 *
 * Thin-film iridescence in MeshPhysicalMaterial is the physically honest way
 * to do this, but it needs both the iridescence extension and an environment
 * to reflect, and where either is missing the disc renders as a black ring —
 * which is what it did. Painting the diffraction into a texture is reliable
 * everywhere, and the material still carries metalness on top, so a machine
 * that can reflect its surroundings gets that too.
 */
const SIZE = 1024

function drawCompactDisc(): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const centre = SIZE / 2

  ctx.fillStyle = '#0b0b10'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // The diffraction sweep. Two rotations of the spectrum around the disc,
  // which is roughly what the eye reads off a real CD under a point source.
  const spectrum = ctx.createConicGradient(0, centre, centre)
  const stops = [
    '#8fd8ff', '#b9a6ff', '#ff9ad5', '#ffd39a', '#c8ffb0',
    '#8fd8ff', '#b9a6ff', '#ff9ad5', '#ffd39a', '#c8ffb0', '#8fd8ff',
  ]
  stops.forEach((colour, index) => spectrum.addColorStop(index / (stops.length - 1), colour))
  ctx.fillStyle = spectrum
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Mute it toward the centre, so the colour sits where the data actually is.
  // The rim is left almost alone: darkening it heavily shades the face like a
  // sphere, and a disc is flat.
  const falloff = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre)
  falloff.addColorStop(0, 'rgba(12,12,18,0.92)')
  falloff.addColorStop(0.28, 'rgba(12,12,18,0.3)')
  falloff.addColorStop(0.55, 'rgba(12,12,18,0.06)')
  falloff.addColorStop(0.96, 'rgba(12,12,18,0.08)')
  falloff.addColorStop(1, 'rgba(12,12,18,0.55)')
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = falloff
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Take some of the heat out of the spectrum: a real disc is silver first
  // and coloured second, not a full-strength rainbow.
  ctx.globalCompositeOperation = 'saturation'
  ctx.fillStyle = 'hsl(0, 55%, 50%)'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Track rings. Very fine, and only in the data area.
  ctx.globalCompositeOperation = 'overlay'
  ctx.lineWidth = 1
  for (let radius = centre * 0.3; radius < centre * 0.98; radius += 2) {
    ctx.strokeStyle = radius % 4 < 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    ctx.beginPath()
    ctx.arc(centre, centre, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'source-over'
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return texture
}

/** The unprinted underside of a record: black wax with its groove bands. */
function drawVinyl(): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const centre = SIZE / 2
  ctx.fillStyle = '#0a0a0d'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Grooves catch light in arcs rather than evenly, so the sheen is a
  // gradient across the face and the rings ride on top of it.
  const sheen = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  sheen.addColorStop(0, 'rgba(120,130,160,0.16)')
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.02)')
  sheen.addColorStop(0.6, 'rgba(150,160,190,0.13)')
  sheen.addColorStop(1, 'rgba(90,100,130,0.04)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.lineWidth = 1
  for (let radius = centre * 0.34; radius < centre * 0.99; radius += 3) {
    // A wider gap every so often reads as the band between tracks.
    const band = Math.floor(radius / 3) % 26 === 0
    ctx.strokeStyle = band ? 'rgba(0,0,0,0.55)' : 'rgba(200,208,228,0.05)'
    ctx.beginPath()
    ctx.arc(centre, centre, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function useDiscSurface(kind: 'cd' | 'vinyl'): Texture | null {
  return useMemo(() => (kind === 'vinyl' ? drawVinyl() : drawCompactDisc()), [kind])
}
