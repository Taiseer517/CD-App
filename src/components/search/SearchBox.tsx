import { useUiStore } from '../../store/useUiStore'

export function SearchBox() {
  const searchQuery = useUiStore((state) => state.searchQuery)
  const setSearchQuery = useUiStore((state) => state.setSearchQuery)

  return (
    <input
      type="search"
      value={searchQuery}
      onChange={(event) => setSearchQuery(event.target.value)}
      placeholder="Search title, artist, genre, tags…"
      className="w-full rounded-md border border-void-700 bg-void-900 px-4 py-2 text-bone-100 placeholder:text-bone-400/60 focus:border-blood-500 focus:outline-none"
    />
  )
}
