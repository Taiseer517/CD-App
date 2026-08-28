import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const WIDTH = 512

/**
 * Draws a title card into a 2D canvas and hands it back as a texture.
 *
 * Chosen over an SDF text renderer because this is a static label that never
 * animates: generating glyph atlases on the GPU for it is a great deal of work
 * for a fixed image, and heavy enough to cost the WebGL context outright on
 * software rendering.
 */
function draw(title: string, subtitle: string, aspect: number): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = Math.round(WIDTH / aspect)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#241a2e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // A hairline keyline, like the printed border on a plain sleeve.
  ctx.strokeStyle = 'rgba(163, 123, 209, 0.28)'
  ctx.lineWidth = 2
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const titleSize = Math.round(canvas.width * 0.082)
  ctx.font = `${titleSize}px Cinzel, Georgia, serif`
  ctx.fillStyle = '#ded3c1'

  // Wrap by measuring, so a long title breaks instead of running off the case.
  const words = title.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > canvas.width * 0.78 && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)

  const capped = lines.slice(0, 4)
  const lineHeight = titleSize * 1.28
  const startY = canvas.height / 2 - ((capped.length - 1) * lineHeight) / 2 - titleSize * 0.4

  capped.forEach((text, index) => {
    ctx.fillText(text, canvas.width / 2, startY + index * lineHeight)
  })

  if (subtitle) {
    ctx.font = `${Math.round(canvas.width * 0.05)}px Cinzel, Georgia, serif`
    ctx.fillStyle = '#988c7d'
    ctx.fillText(subtitle, canvas.width / 2, startY + capped.length * lineHeight + titleSize * 0.5)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function useLabelTexture(
  enabled: boolean,
  title: string,
  subtitle: string,
  aspect: number,
): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!enabled) {
      setTexture(null)
      return
    }

    let active = true
    let created: Texture | null = null

    // Waiting on the webfont avoids baking the label in a fallback serif and
    // never redrawing it once Cinzel arrives.
    const ready = document.fonts?.ready ?? Promise.resolve()
    void ready.then(() => {
      if (!active) return
      created = draw(title, subtitle, aspect)
      setTexture(created)
    })

    return () => {
      active = false
      created?.dispose()
    }
  }, [enabled, title, subtitle, aspect])

  return texture
}
