import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '../components/layout/PageTransition'
import type { CollectionItem } from '../data/schema'
import { useCollectionStore } from '../store/useCollectionStore'

/**
 * The archive as a document.
 *
 * Printed through the browser rather than a PDF library: a print stylesheet
 * gives correct pagination, real vector type, text that can be searched and
 * selected, and nothing to keep up to date. Every browser can save the result
 * as a PDF.
 *
 * The screen palette is abandoned here. A gothic archive is handsome lit from
 * within and unreadable on paper, so this is black on white with hairline
 * rules — the point of the document is that someone can read it, including an
 * insurer who will never see the shelf.
 */

function group(items: CollectionItem[], shelfNames: Map<string | null, string>) {
  const byShelf = new Map<string, CollectionItem[]>()
  for (const item of items) {
    const name = shelfNames.get(item.shelfId ?? null) ?? 'Unfiled'
    const bucket = byShelf.get(name)
    if (bucket) bucket.push(item)
    else byShelf.set(name, [item])
  }
  for (const bucket of byShelf.values()) {
    bucket.sort(
      (a, b) =>
        a.artistOrDirector.localeCompare(b.artistOrDirector) || a.title.localeCompare(b.title),
    )
  }
  return [...byShelf.entries()]
}

export function PrintPage() {
  const items = useCollectionStore((state) => state.items)
  const shelves = useCollectionStore((state) => state.shelves)

  const owned = useMemo(() => items.filter((item) => !item.wishlist), [items])
  const shelfNames = useMemo(() => {
    const names = new Map<string | null, string>([[null, 'Unfiled']])
    for (const shelf of shelves) names.set(shelf.id, shelf.name)
    return names
  }, [shelves])

  const grouped = useMemo(() => group(owned, shelfNames), [owned, shelfNames])

  const byMedium = useMemo(() => {
    const tally = new Map<string, number>()
    for (const item of owned) tally.set(item.type, (tally.get(item.type) ?? 0) + 1)
    return [...tally.entries()].sort((a, b) => b[1] - a[1])
  }, [owned])

  const byArtist = useMemo(() => {
    const tally = new Map<string, CollectionItem[]>()
    for (const item of owned) {
      const key = item.artistOrDirector || 'Unattributed'
      const bucket = tally.get(key)
      if (bucket) bucket.push(item)
      else tally.set(key, [item])
    }
    return [...tally.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [owned])

  const generated = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const mediumLabel: Record<string, string> = { cd: 'Compact discs', vinyl: 'Records', dvd: 'Films' }

  return (
    <PageTransition>
      <div className="print-document">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h2 className="font-display text-2xl text-bone-100">The archive, on paper</h2>
            <p className="text-sm text-bone-400">
              Print this, or choose &ldquo;Save as PDF&rdquo; in the print dialog.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/stats"
              className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-300 transition-colors hover:border-velvet-400"
            >
              Back to stats
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-blood-700 bg-blood-900/50 px-5 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400"
            >
              Print or save as PDF
            </button>
          </div>
        </div>

        <article className="print-sheet">
          <header className="print-title">
            <h1>Zarin&rsquo;s Archive</h1>
            <p className="print-subtitle">A catalogue of the collection</p>
            <p className="print-meta">
              {owned.length} {owned.length === 1 ? 'record' : 'records'} · compiled {generated}
            </p>
            <dl className="print-summary">
              {byMedium.map(([type, count]) => (
                <div key={type}>
                  <dt>{mediumLabel[type] ?? type}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </header>

          {grouped.map(([shelfName, records]) => (
            <section key={shelfName} className="print-shelf">
              <h2>
                {shelfName}
                <span className="print-count">
                  {records.length} {records.length === 1 ? 'record' : 'records'}
                </span>
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Artist or director</th>
                    <th>Year</th>
                    <th>Format</th>
                    <th>Label</th>
                    <th>Catalogue</th>
                    <th>Barcode</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.artistOrDirector}</td>
                      <td className="print-num">{item.year || ''}</td>
                      <td>{item.format}</td>
                      <td>{item.label}</td>
                      <td className="print-num">{item.catalogNumber}</td>
                      <td className="print-num">{item.barcode}</td>
                      <td>{item.conditionOrEdition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          <section className="print-index">
            <h2>Index by artist</h2>
            <ul>
              {byArtist.map(([artist, records]) => (
                <li key={artist}>
                  <span className="print-index-name">{artist}</span>
                  <span className="print-index-titles">
                    {records.map((item) => item.title).join('; ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </PageTransition>
  )
}
