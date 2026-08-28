import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { Rating } from '../components/common/Rating'
import { TagList } from '../components/common/TagList'
import { PageTransition } from '../components/layout/PageTransition'
import { cssUrl, safeImageUrl } from '../data/safeUrl'
import type { CollectionItem } from '../data/schema'
import { useCollectionStore } from '../store/useCollectionStore'

function trackDuration(ms: number | null): string {
  if (!ms) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Tracks grouped by the disc they sit on, in order. */
function discsOf(item: CollectionItem): [number, CollectionItem['trackList']][] {
  const byDisc = new Map<number, CollectionItem['trackList']>()
  for (const track of item.trackList) {
    const disc = track.disc || 1
    const bucket = byDisc.get(disc)
    if (bucket) bucket.push(track)
    else byDisc.set(disc, [track])
  }
  return [...byDisc.entries()].sort((a, b) => a[0] - b[0])
}

function totalRuntime(item: CollectionItem): string {
  const ms = item.trackList.reduce((sum, track) => sum + (track.lengthMs ?? 0), 0)
  if (!ms) return ''
  const minutes = Math.round(ms / 60000)
  return `${minutes} min`
}

/** A field with no value is not rendered at all — never a dash, never a guess. */
function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-bone-400">{label}</dt>
      <dd className="text-bone-200">{value}</dd>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-xs uppercase tracking-[0.18em] text-velvet-300">
      {children}
    </h3>
  )
}

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const item = useCollectionStore((state) => state.items.find((entry) => entry.id === id))
  const deleteItem = useCollectionStore((state) => state.deleteItem)
  const updateItem = useCollectionStore((state) => state.updateItem)
  const [showBack, setShowBack] = useState(false)

  if (!item) {
    return (
      <PageTransition>
        <EmptyState title="Item not found" message="It may have been removed." />
      </PageTransition>
    )
  }

  const accent = item.dominantColor || '#7c4fb0'
  const facing = showBack && item.backCoverImageUrl ? item.backCoverImageUrl : item.coverImageUrl

  async function handleDelete() {
    if (!window.confirm(`Remove "${item!.title}" from the collection?`)) return
    await deleteItem(item!.id)
    navigate(item!.wishlist ? '/wishlist' : '/')
  }

  return (
    <PageTransition>
      <article className="relative overflow-hidden rounded-xl border border-void-700">
        {item.backgroundImageUrl && (
          <>
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-xl"
              style={{ backgroundImage: cssUrl(item.backgroundImageUrl) }}
              aria-hidden="true"
            />
            {/* Tinted with the sleeve's own colour, so each record lights its
                own page rather than every page sharing one purple wash. */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(120% 80% at 20% 0%, ${accent}22, transparent 60%)`,
              }}
              aria-hidden="true"
            />
          </>
        )}

        <div className="relative bg-void-950/80 p-8 backdrop-blur-sm">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              <div
                className="aspect-square overflow-hidden rounded-lg border border-void-700 bg-gradient-to-br from-velvet-900 via-void-900 to-void-950"
                style={{ boxShadow: `0 18px 50px -24px ${accent}` }}
              >
                {facing ? (
                  <img
                    src={safeImageUrl(facing)}
                    alt={`${item.title} ${showBack ? 'back cover' : 'cover art'}`}
                    crossOrigin="anonymous"
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

              {item.backCoverImageUrl && (
                <button
                  type="button"
                  onClick={() => setShowBack((current) => !current)}
                  className="w-full rounded-md border border-void-700 px-3 py-2 text-sm text-bone-300 transition-colors hover:border-velvet-400 hover:text-bone-100"
                >
                  {showBack ? 'Show the front' : 'Turn it over'}
                </button>
              )}

              {item.discImageUrl && (
                <div className="flex items-center gap-3 rounded-md border border-void-700 p-3">
                  <img
                    src={safeImageUrl(item.discImageUrl)}
                    alt=""
                    crossOrigin="anonymous"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <span className="text-xs uppercase tracking-wide text-bone-400">
                    {item.type === 'vinyl' ? 'Label' : 'Disc'}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <h2 className="font-display text-3xl text-bone-100">{item.title}</h2>
                <p className="text-lg text-bone-400">
                  {item.artistOrDirector}
                  {item.year ? ` · ${item.year}` : ''}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-bone-400">Your rating</p>
                <Rating
                  value={item.rating}
                  onChange={(rating) => updateItem(item.id, { rating })}
                />
              </div>

              {/* Facts, and where they came from. Nothing here was typed by
                  hand, and nothing appears unless the source supplied it. */}
              <section>
                <SectionLabel>
                  {item.sourceName ? `From ${item.sourceName}` : 'Details'}
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ml-2 normal-case tracking-normal text-velvet-300 underline-offset-2 hover:underline"
                    >
                      view the source
                    </a>
                  )}
                </SectionLabel>

                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <DetailRow label="Genre" value={item.genre} />
                  <DetailRow label="Label" value={item.label} />
                  <DetailRow label="Format" value={item.format} />
                  <DetailRow label="Catalogue" value={item.catalogNumber} />
                  <DetailRow label="Barcode" value={item.barcode} />
                  <DetailRow label="Pressed in" value={item.country} />
                  <DetailRow
                    label="Runtime"
                    value={item.runtimeMinutes ? `${item.runtimeMinutes} min` : ''}
                  />
                </dl>

                {item.synopsis && (
                  <p className="mt-3 max-w-prose text-sm leading-relaxed text-bone-300">
                    {item.synopsis}
                  </p>
                )}

                {item.cast.length > 0 && (
                  <p className="mt-3 text-sm text-bone-400">
                    <span className="text-xs uppercase tracking-wide">Cast </span>
                    <span className="text-bone-200">{item.cast.join(', ')}</span>
                  </p>
                )}

                <TagList tags={item.tags} />
              </section>

              {/* Hers. Kept visibly apart, so a rating is never mistaken for
                  a review from somewhere else. */}
              {(item.conditionOrEdition || item.dateAcquired || item.notes) && (
                <section>
                  <SectionLabel>Zarin&rsquo;s record</SectionLabel>
                  <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <DetailRow label="Condition / Edition" value={item.conditionOrEdition} />
                    <DetailRow label="Date acquired" value={item.dateAcquired} />
                  </dl>
                  {item.notes && (
                    <p
                      className="mt-3 border-l-2 pl-4 italic text-bone-300"
                      style={{ borderColor: accent }}
                    >
                      {item.notes}
                    </p>
                  )}
                </section>
              )}

              {item.trackList.length > 0 && (
                <div>
                  <h3 className="font-display text-sm uppercase tracking-wide text-velvet-300">
                    Tracklist
                    {totalRuntime(item) && (
                      <span className="ml-2 text-bone-400 normal-case">
                        · {totalRuntime(item)}
                      </span>
                    )}
                  </h3>
                  {discsOf(item).map(([disc, tracks]) => (
                    <div key={disc} className="mt-3">
                      {discsOf(item).length > 1 && (
                        <p className="mb-1 text-xs uppercase tracking-wide text-bone-400">
                          Disc {disc}
                        </p>
                      )}
                      <ol className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        {tracks.map((track) => (
                          <li
                            key={`${disc}-${track.position}-${track.title}`}
                            className="flex justify-between gap-3 border-b border-void-800/60 py-1 text-sm"
                          >
                            <span className="min-w-0 truncate text-bone-300">
                              <span className="mr-2 text-bone-400 tabular-nums">
                                {track.position}
                              </span>
                              {track.title}
                            </span>
                            <span className="shrink-0 text-bone-400 tabular-nums">
                              {trackDuration(track.lengthMs)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Link
                  to="/shelf"
                  className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
                >
                  On the shelf
                </Link>
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
