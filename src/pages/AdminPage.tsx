import { Link } from 'react-router-dom'
import { PageTransition } from '../components/layout/PageTransition'
import { useCollectionStore } from '../store/useCollectionStore'

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminPage() {
  const items = useCollectionStore((state) => state.items)
  const deleteItem = useCollectionStore((state) => state.deleteItem)

  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title))

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Remove "${title}" from the collection?`)) return
    await deleteItem(id)
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-bone-400">
            {items.length} item{items.length === 1 ? '' : 's'} total.{' '}
            {import.meta.env.DEV
              ? 'Changes here write straight to collection.json on disk.'
              : 'Changes here stay in this browser only — use "Export JSON" to save them permanently.'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => downloadJson('collection.json', items)}
              className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
            >
              Export JSON
            </button>
            <Link
              to="/admin/new"
              className="rounded-md border border-blood-700 bg-blood-900/60 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400"
            >
              + Add item
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-void-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-void-900 text-xs uppercase tracking-wide text-bone-400">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Artist / Director</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id} className="border-t border-void-800 hover:bg-void-900/60">
                  <td className="px-4 py-3 text-bone-100">{item.title}</td>
                  <td className="px-4 py-3 text-bone-300">{item.artistOrDirector}</td>
                  <td className="px-4 py-3 uppercase text-bone-400">{item.type}</td>
                  <td className="px-4 py-3 text-bone-400">{item.year}</td>
                  <td className="px-4 py-3">
                    {item.wishlist ? (
                      <span className="text-velvet-300">Wishlist</span>
                    ) : (
                      <span className="text-bone-400">Owned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link to={`/admin/edit/${item.id}`} className="text-blood-300 hover:underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.title)}
                        className="text-bone-400 hover:text-blood-300 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  )
}
