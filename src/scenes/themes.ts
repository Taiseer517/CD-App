/**
 * The looks the bookcase can wear.
 *
 * Every colour and light the shelf uses was a module-level constant before
 * this — good defaults, but nothing she could change. A theme is that same
 * set of values, named, so switching one swaps the whole room at once rather
 * than exposing two dozen sliders.
 */
export type ThemeId = 'cathedral' | 'crypt' | 'ossuary' | 'vigil'

export interface ShelfTheme {
  id: ThemeId
  name: string
  /** One line, in her language, about what the room feels like. */
  description: string

  /** Furniture */
  wood: string
  woodDark: string
  woodLight: string
  metal: string

  /** Light */
  keyColor: string
  rimColor: string
  keyIntensity: number
  ambient: number
  candleColor: string

  /** Air */
  fogNear: number
  fogFar: number
  background: string

  /** Ornament */
  candles: boolean
  roseWindow: boolean
  chains: boolean
  cobwebs: boolean

  /** Two colours for the swatch on the picker. */
  swatch: [string, string]
}

export const THEMES: Record<ThemeId, ShelfTheme> = {
  cathedral: {
    id: 'cathedral',
    name: 'Cathedral',
    description: 'Oak, candlelight and a rose window.',
    wood: '#3a2c48',
    woodDark: '#241a2e',
    woodLight: '#503d63',
    metal: '#8a6f45',
    keyColor: '#ffd0a4',
    rimColor: '#9d70d4',
    keyIntensity: 74,
    ambient: 0.85,
    candleColor: '#ffa851',
    fogNear: 18,
    fogFar: 44,
    background: '#07050a',
    candles: true,
    roseWindow: true,
    chains: false,
    cobwebs: false,
    swatch: ['#503d63', '#ffd0a4'],
  },

  crypt: {
    id: 'crypt',
    name: 'Crypt',
    description: 'Cold stone, green light and old cobwebs.',
    wood: '#2b3540',
    woodDark: '#161d24',
    woodLight: '#3e4d5c',
    metal: '#6f7d72',
    keyColor: '#9fd8c4',
    rimColor: '#4a7fa8',
    keyIntensity: 58,
    ambient: 0.72,
    candleColor: '#b9f2d0',
    fogNear: 13,
    fogFar: 32,
    background: '#05080a',
    candles: true,
    roseWindow: false,
    chains: false,
    cobwebs: true,
    swatch: ['#3e4d5c', '#9fd8c4'],
  },

  ossuary: {
    id: 'ossuary',
    name: 'Ossuary',
    description: 'Bone-pale wood, low amber light and iron chains.',
    wood: '#5a5145',
    woodDark: '#332e27',
    woodLight: '#7d7263',
    metal: '#9a8f7a',
    keyColor: '#ffc98a',
    rimColor: '#c08a5a',
    keyIntensity: 64,
    ambient: 0.8,
    candleColor: '#ffb765',
    fogNear: 16,
    fogFar: 38,
    background: '#0a0806',
    candles: true,
    roseWindow: false,
    chains: true,
    cobwebs: false,
    swatch: ['#7d7263', '#ffc98a'],
  },

  vigil: {
    id: 'vigil',
    name: 'Vigil',
    description: 'Almost dark. One candle, and deep shadow.',
    wood: '#241d2e',
    woodDark: '#120d18',
    woodLight: '#332844',
    metal: '#6b5a3c',
    keyColor: '#ffb066',
    rimColor: '#6b4a9c',
    keyIntensity: 42,
    ambient: 0.5,
    candleColor: '#ff9d3c',
    fogNear: 10,
    fogFar: 26,
    background: '#040308',
    candles: true,
    roseWindow: true,
    chains: true,
    cobwebs: true,
    swatch: ['#332844', '#ffb066'],
  },
}

export const THEME_LIST = Object.values(THEMES)

export const DEFAULT_THEME: ThemeId = 'cathedral'

export function themeById(id: string | undefined): ShelfTheme {
  return THEMES[(id as ThemeId) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
}
