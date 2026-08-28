import { useEffect, useState } from 'react'

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

export function useWebglSupport(): boolean {
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(detectWebgl())
  }, [])

  return supported
}
