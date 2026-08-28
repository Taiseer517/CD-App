import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const WIDTH = 512
const HEIGHT = 96

/**
 * An engraved brass nameplate for the front edge of a shelf.
 *
 * Letters are drawn twice — a dark offset copy, then the light face — which
 * reads as cut into the metal rather than printed onto it.
 */
function draw(name: string, continued: boolean): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const plate = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  plate.addColorStop(0, '#6f5936')
  plate.addColorStop(0.45, '#8d7448')
  plate.addColorStop(1, '#4e3d24')
  ctx.fillStyle = plate
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = 'rgba(28, 20, 10, 0.75)'
  ctx.lineWidth = 3
  ctx.strokeRect(7, 7, WIDTH - 14, HEIGHT - 14)

  const text = (continued ? `${name} — continued` : name).toUpperCase()
  let size = 42
  ctx.font = `${size}px Cinzel, Georgia, serif`
  // Shrink to fit rather than letting a long shelf name run off the plate.
  while (ctx.measureText(text).width > WIDTH - 60 && size > 16) {
    size -= 2
    ctx.font = `${size}px Cinzel, Georgia, serif`
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '4px'

  ctx.fillStyle = 'rgba(24, 17, 8, 0.85)'
  ctx.fillText(text, WIDTH / 2, HEIGHT / 2 + 2)
  ctx.fillStyle = '#f0e4c8'
  ctx.fillText(text, WIDTH / 2, HEIGHT / 2 - 1)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function usePlaqueTexture(name: string, continued: boolean): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    let active = true
    let created: Texture | null = null

    const ready = document.fonts?.ready ?? Promise.resolve()
    void ready.then(() => {
      if (!active) return
      created = draw(name, continued)
      setTexture(created)
    })

    return () => {
      active = false
      created?.dispose()
    }
  }, [name, continued])

  return texture
}
