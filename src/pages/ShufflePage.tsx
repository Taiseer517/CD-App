import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { PageTransition } from '../components/layout/PageTransition'
import { Rating } from '../components/common/Rating'
import { archiveAudio } from '../audio/archiveAudio'
import { cssUrl, safeImageUrl } from '../data/safeUrl'
import type { CollectionItem } from '../data/schema'
import { useCollectionStore } from '../store/useCollectionStore'

/**
 * For when she cannot decide what to put on.
 *
 * Deliberately one record at a time and full-bleed: a grid of options is the
 * problem this is meant to solve.
 */
export function ShufflePage() {
  const items = useCollectionStore((state) => state.items)
  const [pick, setPick] = useState<CollectionItem | null>(null)
  const [shelfId, setShelfId] = useState<string | null>(null)
  const shelves = useCollectionStore((state) => state.shelves)

  const pool = useMemo(
    () =>
      items.filter(
        (item) => !item.wishlist && (shelfId === null || (item.shelfId ?? null) === shelfId),
      ),
    [items, shelfId],
  )

  const draw = useCallback(() => {
    if (pool.length === 0) {
      setPick(null)
      return
    }
    // Never the same record twice running, unless it is the only one.
    const candidates = pool.length > 1 ? pool.filter((item) => item.id !== pick?.id) : pool
    setPick(candidates[Math.floor(Math.random() * candidates.length)])
    archiveAudio.page()
  }, [pool, pick])

  useEffect(() => {
    if (!pick && pool.length > 0) setPick(pool[Math.floor(Math.random() * pool.length)])
  }, [pool, pick])

  if (items.filter((item) => !item.wishlist).length === 0) {
    return (
      <PageTransition>
        <EmptyState title="Nothing to choose from yet" message="Add a record and come back." />
      </PageTransition>
    )
  }

  const accent = pick?.dominantColor || '#7c4fb0'

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-bone-100">Put something on</h2>
            <p className="text-sm text-bone-400">One record, drawn at random.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="shuffle-shelf">
              Draw from
            </label>
            <select
              id="shuffle-shelf"
              value={shelfId ?? ''}
              onChange={(event) => {
                setShelfId(event.target.value || null)
                setPick(null)
              }}
              className="rounded-md border border-void-700 bg-void-950 px-3 py-2 text-sm text-bone-200 focus:border-velvet-400 focus:outline-none"
            >
              <option value="">The whole archive</option>
              {shelves.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={draw}
              className="rounded-md border border-blood-700 bg-blood-900/50 px-5 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400"
            >
              Again
            </button>
          </div>
        </div>

        {pick ? (
          <article className="relative overflow-hidden rounded-xl border border-void-700">
            {pick.backgroundImageUrl && (
              <div
                className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-2xl"
                style={{ backgroundImage: cssUrl(pick.backgroundImageUrl) }}
                aria-hidden="true"
              />
            )}
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(120% 90% at 50% 0%, ${accent}26, transparent 65%)` }}
              aria-hidden="true"
            />

            <div className="relative grid gap-8 bg-void-950/70 p-8 backdrop-blur-sm sm:grid-cols-[minmax(0,320px)_1fr] sm:items-center">
              <div
                className="aspect-square overflow-hidden rounded-lg border border-void-700"
                style={{ boxShadow: `0 24px 60px -28px ${accent}` }}
              >
                {pick.coverImageUrl ? (
                  <img
                    src={safeImageUrl(pick.coverImageUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-velvet-900 to-void-950">
                    <span className="font-display text-3xl tracking-widest text-bone-400/40">
                      {pick.type.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-3xl leading-tight text-bone-100">{pick.title}</h3>
                  <p className="text-lg text-bone-400">
                    {pick.artistOrDirector}
                    {pick.year ? ` · ${pick.year}` : ''}
                  </p>
                </div>

                {pick.genre && (
                  <p className="text-sm uppercase tracking-[0.16em] text-velvet-300">{pick.genre}</p>
                )}

                {pick.rating > 0 && <Rating value={pick.rating} />}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    to={`/item/${pick.id}`}
                    className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400"
                  >
                    Look at it properly
                  </Link>
                  <button
                    type="button"
                    onClick={draw}
                    className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-300 transition-colors hover:border-velvet-400"
                  >
                    Something else
                  </button>
                </div>
              </div>
            </div>
          </article>
        ) : (
          <EmptyState title="Nothing on that shelf" message="Try the whole archive instead." />
        )}
      </div>
    </PageTransition>
  )
}
