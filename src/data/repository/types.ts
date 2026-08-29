import type { CollectionItem, CollectionItemInput, Shelf, ShelfInput } from '../schema'

export interface CollectionSnapshot {
  items: CollectionItem[]
  shelves: Shelf[]
}

export interface CollectionRepository {
  getAll(): Promise<CollectionItem[]>
  getById(id: string): Promise<CollectionItem | undefined>
  create(item: CollectionItemInput): Promise<CollectionItem>
  update(id: string, patch: Partial<CollectionItemInput>): Promise<CollectionItem>
  remove(id: string): Promise<void>

  getShelves(): Promise<Shelf[]>
  createShelf(input: ShelfInput): Promise<Shelf>
  updateShelf(id: string, patch: Partial<ShelfInput>): Promise<Shelf>
  removeShelf(id: string): Promise<void>

  /** Persists a reordering in one transaction rather than one write per case. */
  savePlacements(placements: { id: string; shelfId: string | null; position: number }[]): Promise<void>

  /** The same, for the order the shelves themselves hang in on the wall. */
  saveShelfOrder(orders: { id: string; order: number }[]): Promise<void>

  /** Wholesale replace, used by Import and by loading a synced file. */
  replaceAll(snapshot: CollectionSnapshot): Promise<void>

  /** Discards everything and lays out the bundled collection again. */
  resetToStarter(): Promise<CollectionSnapshot>
  snapshot(): Promise<CollectionSnapshot>
}
