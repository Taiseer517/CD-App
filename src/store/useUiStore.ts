import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_THEME, type ThemeId } from '../scenes/themes'

export interface CollectionFilters {
  genre: string | null
  format: string | null
  year: number | null
  tag: string | null
  minRating: number | null
}

const emptyFilters: CollectionFilters = {
  genre: null,
  format: null,
  year: null,
  tag: null,
  minRating: null,
}

interface UiState {
  searchQuery: string
  filters: CollectionFilters
  viewMode: '3d' | 'simple'
  cinematicEffects: boolean
  theme: ThemeId
  soundOn: boolean
  setSearchQuery: (query: string) => void
  setFilter: <K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K]) => void
  resetFilters: () => void
  setViewMode: (mode: '3d' | 'simple') => void
  setCinematicEffects: (enabled: boolean) => void
  setTheme: (theme: ThemeId) => void
  setSoundOn: (on: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      searchQuery: '',
      filters: emptyFilters,
      viewMode: '3d',
      cinematicEffects: false,
      theme: DEFAULT_THEME,
      // Never true on load: audio needs a gesture, and a page that starts
      // making noise by itself is the thing everyone hates.
      soundOn: false,

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setFilter: (key, value) =>
        set((state) => ({ filters: { ...state.filters, [key]: value } })),
      resetFilters: () => set({ filters: emptyFilters, searchQuery: '' }),
      setViewMode: (viewMode) => set({ viewMode }),
      setCinematicEffects: (cinematicEffects) => set({ cinematicEffects }),
      setTheme: (theme) => set({ theme }),
      setSoundOn: (soundOn) => set({ soundOn }),
    }),
    {
      name: 'archive-ui-prefs',
      partialize: (state) => ({
        viewMode: state.viewMode,
        cinematicEffects: state.cinematicEffects,
        theme: state.theme,
      }),
    },
  ),
)
