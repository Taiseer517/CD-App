import { localRepository } from './localRepository'
import type { CollectionRepository } from './types'

export function getRepository(): CollectionRepository {
  return localRepository
}

export type { CollectionRepository } from './types'
