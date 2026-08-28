import { Link } from 'react-router-dom'
import { PageTransition } from '../components/layout/PageTransition'
import { RefreshPanel } from '../components/admin/RefreshPanel'
import { StoragePanel } from '../components/storage/StoragePanel'
import { useCollectionStore } from '../store/useCollectionStore'

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
        <RefreshPanel />

        <StoragePanel />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-bone-400">
            {items.length} item{items.length === 1 ? '' : 's'} in the archive.
          </p>
          <Link
            to="/admin/new"
            className="rounded-md border border-blood-700 bg-blood-900/60 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400"
          >
            + Add item
          </Link>
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
