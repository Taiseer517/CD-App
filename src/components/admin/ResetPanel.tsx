import { useState } from 'react'
import { useCollectionStore } from '../../store/useCollectionStore'

/**
 * Throws the archive away and lays out the bundled collection again.
 *
 * The starter collection is only ever written once, on a browser's very first
 * visit — so once the archive exists, updating the bundled data can never
 * reach it. That is the right behaviour almost always: nobody wants a deploy
 * quietly rewriting what they own. It does mean there has to be one explicit,
 * deliberate way to say "no, take the new one", and this is it.
 *
 * Destructive, and it says so. Export first if there is anything here worth
 * keeping.
 */
export function ResetPanel() {
  const items = useCollectionStore((state) => state.items)
  const resetToStarter = useCollectionStore((state) => state.resetToStarter)
  const exportArchive = useCollectionStore((state) => state.exportArchive)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleReset() {
    const warning =
      `This deletes all ${items.length} ${items.length === 1 ? 'record' : 'records'} in the ` +
      'archive, along with every shelf placement, and replaces them with the curated ' +
      'collection. Ratings, notes and condition go with them. It cannot be undone.\n\n' +
      'Export first if you want a copy. Continue?'
    if (!window.confirm(warning)) return

    setBusy(true)
    setResult(null)
    try {
      const count = await resetToStarter()
      setResult(`The archive now holds ${count} ${count === 1 ? 'record' : 'records'}.`)
    } catch (err) {
      setResult(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-blood-700/50 bg-blood-900/10 p-6">
      <h3 className="font-display text-lg text-bone-100">Start again from the curated collection</h3>
      <p className="mt-2 max-w-prose text-sm text-bone-400">
        Replaces everything here with the records bundled with the archive, each one sourced from
        MusicBrainz and the Cover Art Archive. Use this to take a corrected catalogue after an
        update — the archive is only ever seeded once, so a new one cannot otherwise reach a
        browser that already holds records.
      </p>
      <p className="mt-2 max-w-prose text-sm text-blood-300">
        This deletes what is here now, including your ratings and notes. Export first.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportArchive}
          className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
        >
          Export a copy first
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleReset}
          className="rounded-md border border-blood-700 bg-blood-900/40 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400 disabled:opacity-50"
        >
          {busy ? 'Replacing…' : 'Replace everything'}
        </button>
        {result && <p className="text-sm text-velvet-300">{result}</p>}
      </div>
    </section>
  )
}
