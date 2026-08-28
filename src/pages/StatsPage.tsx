import { Link } from 'react-router-dom'
import { AcquisitionTimeline } from '../components/stats/AcquisitionTimeline'
import { GenreBreakdownChart } from '../components/stats/GenreBreakdownChart'
import { StatTile } from '../components/stats/StatTile'
import { TopArtistCard } from '../components/stats/TopArtistCard'
import { PageTransition } from '../components/layout/PageTransition'
import { useCollectionStore } from '../store/useCollectionStore'

export function StatsPage() {
  const items = useCollectionStore((state) => state.items)
  const owned = items.filter((item) => !item.wishlist)
  const wishlist = items.filter((item) => item.wishlist)
  const genreCount = new Set(owned.map((item) => item.genre).filter(Boolean)).size

  return (
    <PageTransition>
      <div className="space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-bone-400">What the archive holds.</p>
          <Link
            to="/print"
            className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
          >
            The archive on paper
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Owned items" value={owned.length} />
          <StatTile label="Wishlist items" value={wishlist.length} />
          <StatTile label="Genres represented" value={genreCount} />
          <StatTile
            label="Average rating"
            value={
              owned.length > 0
                ? (owned.reduce((sum, item) => sum + item.rating, 0) / owned.length).toFixed(1)
                : '—'
            }
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_280px]">
          <section className="rounded-lg border border-void-700 bg-void-900/40 p-6">
            <h3 className="mb-4 font-display text-xl text-bone-100">Genre breakdown</h3>
            <GenreBreakdownChart items={owned} />
          </section>

          <TopArtistCard items={owned} />
        </div>

        <section className="rounded-lg border border-void-700 bg-void-900/40 p-6">
          <h3 className="mb-4 font-display text-xl text-bone-100">Acquisition timeline</h3>
          <AcquisitionTimeline items={owned} />
        </section>
      </div>
    </PageTransition>
  )
}
