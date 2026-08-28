import { deleteMeta, readMeta, writeMeta } from './idb'
import { z } from 'zod'
import {
  CollectionItemSchema,
  ShelfSchema,
  type ArchiveFile,
  type CollectionItem,
  type Shelf,
} from './schema'

const HANDLE_KEY = 'archiveFileHandle'
const SUGGESTED_NAME = 'zarins-archive.json'

/**
 * Keeps a real JSON file on disk in step with the collection.
 *
 * IndexedDB is the working copy, but it lives inside browser storage and dies
 * with it. Pointing this at a file in Documents means the collection is an
 * ordinary file the owner can see, copy to a USB stick, and back up — which is
 * what makes the installed app feel like a program rather than a website.
 *
 * Chromium-only. Everywhere else the app falls back to manual Export/Import.
 */

export function isFileSyncSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
}

export function buildArchive(items: CollectionItem[], shelves: Shelf[]): ArchiveFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    shelves,
  }
}

async function hasPermission(handle: FileSystemFileHandle, request: boolean): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' }
  // Older Chromium exposes neither method; assume usable and let a write fail loudly.
  if (!handle.queryPermission) return true
  if ((await handle.queryPermission(options)) === 'granted') return true
  if (!request || !handle.requestPermission) return false
  return (await handle.requestPermission(options)) === 'granted'
}

/** Prompts once for a location, then remembers the handle across sessions. */
export async function chooseArchiveFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: SUGGESTED_NAME,
      id: 'the-archive-collection',
      types: [{ description: "Zarin's Archive collection", accept: { 'application/json': ['.json'] } }],
    })
    await writeMeta(HANDLE_KEY, handle)
    return handle
  } catch (err) {
    // The picker rejects with AbortError when the dialog is dismissed; that is
    // a normal outcome, not a failure worth surfacing.
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }
}

/**
 * Returns the remembered handle if it still exists and is still writable.
 * Called on startup, where the permission prompt must not be triggered —
 * Chromium only allows that from a user gesture.
 */
export async function restoreArchiveFile(): Promise<FileSystemFileHandle | null> {
  if (!isFileSyncSupported()) return null
  try {
    const handle = await readMeta<FileSystemFileHandle>(HANDLE_KEY)
    if (!handle) return null
    return (await hasPermission(handle, false)) ? handle : null
  } catch {
    return null
  }
}

/** Re-prompts for a handle whose permission lapsed. Must run from a click. */
export async function reconnectArchiveFile(): Promise<FileSystemFileHandle | null> {
  const handle = await readMeta<FileSystemFileHandle>(HANDLE_KEY)
  if (!handle) return null
  return (await hasPermission(handle, true)) ? handle : null
}

export async function forgetArchiveFile(): Promise<void> {
  await deleteMeta(HANDLE_KEY)
}

export async function writeArchiveFile(
  handle: FileSystemFileHandle,
  archive: ArchiveFile,
): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(JSON.stringify(archive, null, 2))
  } finally {
    // close() also commits the file; skipping it on the error path would leave
    // a zero-length file where the collection used to be.
    await writable.close()
  }
}

export async function readArchiveFile(handle: FileSystemFileHandle): Promise<ArchiveFile> {
  const file = await handle.getFile()
  return parseArchive(await file.text())
}

/**
 * Accepts both the current wrapped format and a bare array of items, so a
 * collection.json exported by the old dev-server write endpoint still imports.
 *
 * Individual bad records are skipped rather than failing the whole file — one
 * corrupt row in a backup of two hundred should cost one row, not the restore.
 * A file where nothing at all parses is a different matter and still throws,
 * because silently importing an empty collection over a real one loses data.
 */
export function parseArchive(text: string): ArchiveFile {
  const raw: unknown = JSON.parse(text)
  const envelope = Array.isArray(raw)
    ? { version: 1 as const, exportedAt: new Date().toISOString(), items: raw, shelves: [] }
    : raw

  const shape = z
    .object({
      version: z.literal(1).default(1),
      exportedAt: z.string().default(() => new Date().toISOString()),
      // No default: a file with no items key at all is not an archive, and
      // treating it as an empty one would quietly wipe the collection it
      // replaced. A genuinely empty export still carries items: [].
      items: z.array(z.unknown()),
      shelves: z.array(z.unknown()).default([]),
    })
    .parse(envelope)

  const items: CollectionItem[] = []
  for (const entry of shape.items) {
    const parsed = CollectionItemSchema.safeParse(entry)
    if (parsed.success) items.push(parsed.data)
    else console.warn('Skipping unreadable record during import', parsed.error.flatten())
  }

  if (shape.items.length > 0 && items.length === 0) {
    throw new Error('No readable records found in that file.')
  }

  const shelves: Shelf[] = []
  for (const entry of shape.shelves) {
    const parsed = ShelfSchema.safeParse(entry)
    if (parsed.success) shelves.push(parsed.data)
  }

  return { version: 1, exportedAt: shape.exportedAt, items, shelves }
}

export function downloadArchive(archive: ArchiveFile): void {
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `zarins-archive-${archive.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
