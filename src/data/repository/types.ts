import type { CollectionItem, CollectionItemInput } from '../schema'

export interface CollectionRepository {
  getAll(): Promise<CollectionItem[]>
  getById(id: string): Promise<CollectionItem | undefined>
  create(item: CollectionItemInput): Promise<CollectionItem>
  update(id: string, patch: Partial<CollectionItemInput>): Promise<CollectionItem>
  remove(id: string): Promise<void>
}
