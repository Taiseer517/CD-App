import { useMemo, useRef, useState } from 'react'
import { PageTransition } from '../components/layout/PageTransition'
import { ArchClip } from '../components/wall/ArchClip'
import { ShelfAlcove } from '../components/wall/ShelfAlcove'
import { ThemePicker } from '../components/wall/ThemePicker'
import { UNFILED_SLUG } from '../data/shelfRoutes'
import type { CollectionItem } from '../data/schema'
import { useCollectionStore } from '../store/useCollectionStore'
import { themeById } from '../scenes/themes'
import { useUiStore } from '../store/useUiStore'

export function WallPage() {
  const items = useCollectionStore((state) => state.items)
  const shelves = useCollectionStore((state) => state.shelves)
  const addShelf = useCollectionStore((state) => state.addShelf)
  const renameShelf = useCollectionStore((state) => state.renameShelf)
  const deleteShelf = useCollectionStore((state) => state.deleteShelf)
  const reorderShelves = useCollectionStore((state) => state.reorderShelves)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'music' | 'film'>('music')
  const [editMode, setEditMode] = useState(false)
  const dragFrom = useRef<string | null>(null)
  const themeId = useUiStore((state) => state.theme)
  const theme = themeById(themeId)
  const setTheme = useUiStore((state) => state.setTheme)

  const owned = useMemo(() => items.filter((item) => !item.wishlist), [items])

  const grouped = useMemo(() => {
    const byShelf = new Map<string | null, CollectionItem[]>()
    for (const item of owned) {
      const key = item.shelfId && shelves.some((s) => s.id === item.shelfId) ? item.shelfId : null
      const bucket = byShelf.get(key)
      if (bucket) bucket.push(item)
      else byShelf.set(key, [item])
    }
    // Records with cover art first, so an alcove shows artwork rather than
    // whatever happens to sit in position zero.
    for (const bucket of byShelf.values()) {
      bucket.sort((a, b) => Number(Boolean(b.coverImageUrl)) - Number(Boolean(a.coverImageUrl)))
    }
    return byShelf
  }, [owned, shelves])

  // Unfiled used to appear under music only, so an unshelved film was on the
  // wall nowhere at all — present in the archive, reachable by its own URL,
  // and invisible where you would look for it. Each kind now gathers its own.
  const unfiledByKind = useMemo(() => {
    const unfiled = grouped.get(null) ?? []
    return {
      music: unfiled.filter((item) => item.type !== 'dvd'),
      film: unfiled.filter((item) => item.type === 'dvd'),
    }
  }, [grouped])

  async function handleCreate(event: React.FormEvent, kind: 'music' | 'film' = 'music') {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    await addShelf({ name, order: shelves.length, accent: '', kind })
    setNewName('')
  }

  /** Reorders within one kind's run; the other kind keeps the order it had. */
  async function moveShelf(ordered: string[], fromId: string, toId: string) {
    const from = ordered.indexOf(fromId)
    const to = ordered.indexOf(toId)
    if (from === -1 || to === -1 || from === to) return
    const next = [...ordered]
    next.splice(to, 0, ...next.splice(from, 1))
    await reorderShelves(next)
  }

  return (
    <PageTransition>
      <ArchClip />

      {/* The wall runs the full width of the window: a wall inset in a page
          with margins either side is a poster of a wall. */}
      <div className="stone-wall -mx-6 -mt-10 space-y-10 px-6 pb-14 pt-10 sm:px-10 lg:px-14">
        <header className="text-center">
          <h2 className="font-blackletter text-3xl tracking-wide text-bone-100 sm:text-4xl">
            The Wall
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-bone-400">
            Every shelf in the archive. Step into one to handle what is on it.
          </p>

          {shelves.length > 0 && (
            <button
              type="button"
              onClick={() => setEditMode((current) => !current)}
              aria-pressed={editMode}
              className={`mt-4 rounded-md border px-4 py-1.5 text-xs uppercase tracking-[0.16em] transition-colors ${
                editMode
                  ? 'border-velvet-400 bg-velvet-900/40 text-bone-100'
                  : 'border-void-700 text-bone-400 hover:border-velvet-700 hover:text-bone-200'
              }`}
            >
              {editMode ? 'Done arranging' : 'Rearrange shelves'}
            </button>
          )}

          {editMode && (
            <p className="mx-auto mt-2 max-w-md text-xs text-bone-400/80">
              Drag a shelf by its handle to move it. Rename with the pencil, take it down with
              the cross — records on a shelf you take down move to Unfiled rather than being lost.
            </p>
          )}
        </header>

        {/* Music and film are catalogued differently and are kept apart:
            a film has a director and a runtime where a record has an artist,
            a pressing and a tracklist, and shelving them together makes both
            look wrong. */}
        {(['music', 'film'] as const).map((kind) => {
          const inKind = [...shelves]
            .filter((shelf) => shelf.kind === kind)
            .sort((a, b) => a.order - b.order)
          const kindUnfiled = unfiledByKind[kind]
          const showUnfiled = kindUnfiled.length > 0
          if (inKind.length === 0 && !showUnfiled) return null
          const orderedIds = inKind.map((shelf) => shelf.id)

          return (
            <section key={kind} className="space-y-5">
              <h3 className="text-center font-display text-[0.62rem] uppercase tracking-[0.32em] text-bone-400/70">
                {kind === 'music' ? 'Records and discs' : 'Films'}
              </h3>

              <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
                {inKind.map((shelf, index) => (
                  <ShelfAlcove
                    key={shelf.id}
                    id={shelf.id}
                    to={`/shelf/${shelf.id}`}
                    name={shelf.name}
                    count={(grouped.get(shelf.id) ?? []).length}
                    items={grouped.get(shelf.id) ?? []}
                    index={index}
                    theme={theme}
                    editMode={editMode}
                    onRename={renameShelf}
                    onDelete={deleteShelf}
                    onDragStart={() => {
                      dragFrom.current = shelf.id
                    }}
                    onDrop={() => {
                      const from = dragFrom.current
                      dragFrom.current = null
                      if (from) void moveShelf(orderedIds, from, shelf.id)
                    }}
                  />
                ))}

                {showUnfiled && (
                  <ShelfAlcove
                    to={`/shelf/${UNFILED_SLUG}`}
                    name="Unfiled"
                    count={kindUnfiled.length}
                    items={kindUnfiled}
                    index={inKind.length}
                    theme={theme}
                  />
                )}
              </div>
            </section>
          )
        })}

        <ThemePicker value={themeId} onChange={setTheme} />

        <form
          onSubmit={(event) => handleCreate(event, newKind)}
          className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Build another shelf…"
            className="min-w-0 flex-1 rounded-md border border-void-700 bg-void-950 px-3 py-2 text-sm text-bone-100 placeholder:text-bone-400/50 focus:border-velvet-400 focus:outline-none"
          />
          <div className="flex overflow-hidden rounded-md border border-void-700">
            {(['music', 'film'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setNewKind(kind)}
                aria-pressed={newKind === kind}
                className={`px-3 py-2 text-sm capitalize transition-colors ${
                  newKind === kind
                    ? 'bg-velvet-900/50 text-bone-100'
                    : 'text-bone-400 hover:text-bone-200'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400 disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>
    </PageTransition>
  )
}
