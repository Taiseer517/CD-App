import { useState } from 'react'
import type { Shelf } from '../../data/schema'

interface ShelfManagerProps {
  shelves: Shelf[]
  counts: Map<string | null, number>
  unfiledCount: number
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ShelfManager({
  shelves,
  counts,
  unfiledCount,
  onCreate,
  onRename,
  onDelete,
}: ShelfManagerProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    await onCreate(name)
    setNewName('')
  }

  async function commitRename(id: string) {
    const name = editingName.trim()
    if (name) await onRename(id, name)
    setEditingId(null)
  }

  return (
    <div className="rounded-lg border border-void-700 bg-void-900/50 p-4">
      <h3 className="font-display text-sm uppercase tracking-wide text-bone-400">Shelves</h3>
      <p className="mt-1 text-xs text-bone-400">
        Drag any case from one shelf to another to rearrange them.
      </p>

      <ul className="mt-3 space-y-1">
        {shelves.map((shelf) => (
          <li key={shelf.id} className="flex items-center gap-2 text-sm">
            {editingId === shelf.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={() => commitRename(shelf.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename(shelf.id)
                  if (event.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 rounded border border-velvet-700 bg-void-950 px-2 py-1 text-bone-100 focus:outline-none"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(shelf.id)
                    setEditingName(shelf.name)
                  }}
                  className="flex-1 text-left text-bone-200 hover:text-bone-100"
                >
                  {shelf.name}
                </button>
                <span className="text-xs text-bone-400">{counts.get(shelf.id) ?? 0}</span>
                <button
                  type="button"
                  onClick={() => onDelete(shelf.id)}
                  aria-label={`Delete the ${shelf.name} shelf`}
                  className="text-bone-400 transition-colors hover:text-blood-400"
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}

        {unfiledCount > 0 && (
          <li className="flex items-center gap-2 border-t border-void-800 pt-2 text-sm text-bone-400">
            <span className="flex-1 italic">Unfiled</span>
            <span className="text-xs">{unfiledCount}</span>
          </li>
        )}
      </ul>

      <form onSubmit={handleCreate} className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New shelf…"
          className="min-w-0 flex-1 rounded border border-void-700 bg-void-950 px-2 py-1 text-sm text-bone-100 placeholder:text-bone-400/50 focus:border-velvet-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="rounded border border-velvet-700 px-3 py-1 text-sm text-bone-200 transition-colors hover:border-velvet-400 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <p className="mt-3 text-xs text-bone-400">
        Deleting a shelf keeps its records — they move to Unfiled.
      </p>
    </div>
  )
}
