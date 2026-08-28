import type { CollectionItem } from '../data/schema'

export interface Ambience {
  keyColor: string
  rimColor: string
  fogNear: number
  fogFar: number
  driftSpeed: number
  keyIntensity: number
}

/**
 * The room takes its mood from what is actually on the shelf. Doom slows the
 * drift and closes the fog in; gothic rock lifts the light toward violet.
 * Kept deliberately narrow — a shift you feel rather than a light show.
 */
const MOODS: { match: RegExp; ambience: Partial<Ambience> }[] = [
  {
    match: /doom|funeral|sludge/i,
    ambience: { fogNear: 11, fogFar: 26, driftSpeed: 0.07, keyColor: '#c98a52', keyIntensity: 40 },
  },
  {
    match: /black|death|blackened/i,
    ambience: { fogNear: 12, fogFar: 28, driftSpeed: 0.1, keyColor: '#b8734a', rimColor: '#5b2f8a' },
  },
  {
    match: /gothic rock|darkwave|post-punk|ethereal|neoclassical/i,
    ambience: { keyColor: '#d8a06a', rimColor: '#a37bd1', fogNear: 15, fogFar: 36, driftSpeed: 0.15 },
  },
  {
    match: /gothic/i,
    ambience: { keyColor: '#d09155', rimColor: '#7c4fb0', fogNear: 13, fogFar: 30 },
  },
]

const BASE: Ambience = {
  keyColor: '#ffc08c',
  rimColor: '#8a5cc0',
  fogNear: 14,
  fogFar: 34,
  driftSpeed: 0.13,
  keyIntensity: 52,
}

export function deriveAmbience(items: CollectionItem[]): Ambience {
  if (items.length === 0) return BASE

  const tally = new Map<number, number>()
  for (const item of items) {
    const haystack = `${item.genre} ${item.tags.join(' ')}`
    MOODS.forEach((mood, index) => {
      if (mood.match.test(haystack)) tally.set(index, (tally.get(index) ?? 0) + 1)
    })
  }

  let winner = -1
  let best = 0
  for (const [index, count] of tally) {
    if (count > best) {
      best = count
      winner = index
    }
  }

  // A single doom record on a shelf of forty should not darken the whole room.
  if (winner === -1 || best < items.length * 0.25) return BASE
  return { ...BASE, ...MOODS[winner].ambience }
}
