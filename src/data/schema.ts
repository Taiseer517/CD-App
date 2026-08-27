import { z } from 'zod'

export const MediaTypeSchema = z.enum(['cd', 'dvd', 'vinyl'])
export type MediaType = z.infer<typeof MediaTypeSchema>

export const CollectionItemSchema = z.object({
  id: z.string().uuid(),
  type: MediaTypeSchema,
  title: z.string().min(1),
  artistOrDirector: z.string().default(''),
  year: z.number().int().min(1900).max(2100),
  label: z.string().default(''),
  genre: z.string().default(''),
  format: z.string().default(''),
  coverImageUrl: z.string().default(''),
  backgroundImageUrl: z.string().default(''),
  tags: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).default(0),
  notes: z.string().default(''),
  conditionOrEdition: z.string().default(''),
  dateAcquired: z.string().default(''),
  wishlist: z.boolean().default(false),
})

export type CollectionItem = z.infer<typeof CollectionItemSchema>

export const CollectionItemInputSchema = CollectionItemSchema.omit({ id: true })
export type CollectionItemInput = z.infer<typeof CollectionItemInputSchema>

export function toCollectionItemInput(item: CollectionItem): CollectionItemInput {
  const { id, ...rest } = item
  return rest
}
