import { indexedDbRepository } from './indexedDbRepository'
import type { CollectionRepository } from './types'

export function getRepository(): CollectionRepository {
  return indexedDbRepository
}

export type { CollectionRepository, CollectionSnapshot } from './types'
