import { useState } from 'react'

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Probed once on first render rather than in an effect, so the shelf never
 * renders a frame assuming WebGL works and then tears it down.
 */
export function useWebglSupport(): boolean {
  const [supported] = useState(detectWebgl)
  return supported
}
