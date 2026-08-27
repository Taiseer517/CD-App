import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { Rating } from '../components/common/Rating'
import { TagList } from '../components/common/TagList'
import { PageTransition } from '../components/layout/PageTransition'
import { useCollectionStore } from '../store/useCollectionStore'

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-bone-400">{label}</dt>
      <dd className="text-bone-200">{value}</dd>
    </div>
  )
}

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const item = useCollectionStore((state) => state.items.find((entry) => entry.id === id))
  const deleteItem = useCollectionStore((state) => state.deleteItem)

  if (!item) {
    return (
      <PageTransition>
        <EmptyState title="Item not found" message="It may have been removed." />
      </PageTransition>
    )
  }

  const handleDelete = async () => {
    if (!window.confirm(`Remove "${item.title}" from the collection?`)) return
    await deleteItem(item.id)
    navigate(item.wishlist ? '/wishlist' : '/')
  }

  return (
    <PageTransition>
      <article className="relative overflow-hidden rounded-xl border border-void-700">
        {item.backgroundImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${item.backgroundImageUrl})` }}
            aria-hidden="true"
          />
        )}
        <div className="relative bg-void-950/70 p-8 backdrop-blur-sm">
          <div className="grid gap-8 sm:grid-cols-[240px_1fr]">
            <div className="aspect-square overflow-hidden rounded-lg border border-void-700 bg-gradient-to-br from-velvet-900 via-void-900 to-void-950">
              {item.coverImageUrl ? (
                <img
                  src={item.coverImageUrl}
                  alt={`${item.title} cover art`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-4xl tracking-widest text-bone-400/30">
                    {item.type.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="font-display text-3xl text-bone-100">{item.title}</h2>
                <p className="text-lg text-bone-400">
                  {item.artistOrDirector}
                  {item.year ? ` · ${item.year}` : ''}
                </p>
              </div>

              <Rating value={item.rating} />

              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <DetailRow label="Genre" value={item.genre} />
                <DetailRow label="Label" value={item.label} />
                <DetailRow label="Format" value={item.format} />
                <DetailRow label="Condition / Edition" value={item.conditionOrEdition} />
                <DetailRow label="Date acquired" value={item.dateAcquired} />
                <DetailRow label="Status" value={item.wishlist ? 'Wishlist' : 'Owned'} />
              </dl>

              <TagList tags={item.tags} />

              {item.notes && (
                <p className="border-l-2 border-blood-700 pl-4 italic text-bone-300">{item.notes}</p>
              )}

              <div className="flex gap-3 pt-4">
                <Link
                  to={`/admin/edit/${item.id}`}
                  className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md border border-blood-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-blood-400"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </PageTransition>
  )
}
