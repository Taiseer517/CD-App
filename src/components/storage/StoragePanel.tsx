import { useRef, useState } from 'react'
import { useCollectionStore } from '../../store/useCollectionStore'

function formatSavedAt(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const panelClass = 'rounded-xl border border-void-700 bg-void-900/60 p-6'
const buttonClass =
  'rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50'

export function StoragePanel() {
  const syncState = useCollectionStore((state) => state.syncState)
  const syncError = useCollectionStore((state) => state.syncError)
  const lastSavedAt = useCollectionStore((state) => state.lastSavedAt)
  const itemCount = useCollectionStore((state) => state.items.length)
  const connectFile = useCollectionStore((state) => state.connectFile)
  const reconnectFile = useCollectionStore((state) => state.reconnectFile)
  const disconnectFile = useCollectionStore((state) => state.disconnectFile)
  const exportArchive = useCollectionStore((state) => state.exportArchive)
  const importArchive = useCollectionStore((state) => state.importArchive)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setNotice(null)
    try {
      const count = await importArchive(file)
      setNotice(`Loaded ${count} ${count === 1 ? 'record' : 'records'} from ${file.name}.`)
    } catch (err) {
      setNotice(`That file could not be read: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
      // Clearing lets the same file be picked twice in a row.
      event.target.value = ''
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={panelClass}>
      <h3 className="font-display text-lg text-bone-100">Where your collection is kept</h3>

      <p className="mt-2 max-w-prose text-sm text-bone-400">
        Every change is saved on this computer automatically — {itemCount}{' '}
        {itemCount === 1 ? 'record is' : 'records are'} stored right now. For a copy you can see,
        move and back up yourself, keep it in a file as well.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            syncState === 'connected'
              ? 'bg-velvet-400'
              : syncState === 'saving'
                ? 'bg-bone-400'
                : syncState === 'stale' || syncState === 'error'
                  ? 'bg-blood-400'
                  : 'bg-void-700'
          }`}
          aria-hidden="true"
        />
        <p className="text-sm text-bone-200">
          {syncState === 'connected' &&
            `Saved to your file${lastSavedAt ? ` at ${formatSavedAt(lastSavedAt)}` : ''}.`}
          {syncState === 'saving' && 'Saving…'}
          {syncState === 'off' && 'Kept in this browser only.'}
          {syncState === 'stale' && 'The link to your file needs renewing.'}
          {syncState === 'error' && 'Something went wrong saving to your file.'}
          {syncState === 'unsupported' &&
            'This browser cannot save to a file directly — use Export to keep a backup.'}
        </p>
      </div>

      {syncState === 'stale' && (
        <p className="mt-2 max-w-prose text-sm text-bone-400">
          Browsers forget file permissions when they restart. Nothing has been lost — your collection
          is safe in this browser. Reconnect to start saving to the file again.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {syncState === 'off' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(connectFile)}
            className={`${buttonClass} border-velvet-700 text-bone-100 hover:border-velvet-400`}
          >
            Keep my archive in a file
          </button>
        )}

        {syncState === 'stale' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(reconnectFile)}
            className={`${buttonClass} border-blood-700 text-bone-100 hover:border-blood-400`}
          >
            Reconnect my file
          </button>
        )}

        {(syncState === 'connected' || syncState === 'saving') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(disconnectFile)}
            className={`${buttonClass} border-void-700 text-bone-400 hover:border-bone-400`}
          >
            Stop saving to the file
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={exportArchive}
          className={`${buttonClass} border-void-700 text-bone-200 hover:border-velvet-400`}
        >
          Export a backup
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className={`${buttonClass} border-void-700 text-bone-200 hover:border-velvet-400`}
        >
          Restore from a backup
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {notice && <p className="mt-4 text-sm text-velvet-300">{notice}</p>}
      {syncError && syncState !== 'stale' && (
        <p className="mt-2 text-sm text-blood-400">{syncError}</p>
      )}

      <p className="mt-5 border-t border-void-700 pt-4 text-xs text-bone-400">
        Restoring from a backup replaces everything currently in the archive.
      </p>
    </section>
  )
}
