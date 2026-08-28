import { z } from 'zod'

export const MediaTypeSchema = z.enum(['cd', 'dvd', 'vinyl'])
export type MediaType = z.infer<typeof MediaTypeSchema>

export const TrackSchema = z.object({
  position: z.number().int().min(0),
  title: z.string(),
  lengthMs: z.number().int().nullable().default(null),
})
export type Track = z.infer<typeof TrackSchema>

export const CollectionItemSchema = z.object({
  // Deliberately not .uuid(): ids only need to be unique, and demanding the
  // format breaks two real paths — crypto.randomUUID is unavailable outside a
  // secure context, and an imported backup may carry ids from anywhere.
  id: z.string().min(1),
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

  // --- Shelf placement (Phase 4). A null shelfId means "not filed yet";
  // the shelf view gathers those into an Unfiled row rather than hiding them.
  shelfId: z.string().nullable().default(null),
  position: z.number().int().default(0),

  // --- Artwork beyond the front cover. backCoverImageUrl drives the case
  // flip, discImageUrl the disc face once a case is open.
  backCoverImageUrl: z.string().default(''),
  discImageUrl: z.string().default(''),

  // Sampled from the cover art at import and used to tint the light falling
  // on this item, so each case lights its own patch of shelf.
  dominantColor: z.string().default(''),

  // --- Provenance from the metadata connectors, kept so a record can be
  // re-fetched later without searching for it again.
  musicbrainzId: z.string().default(''),
  tmdbId: z.string().default(''),
  barcode: z.string().default(''),
  catalogNumber: z.string().default(''),
  country: z.string().default(''),
  trackList: z.array(TrackSchema).default([]),
})

export type CollectionItem = z.infer<typeof CollectionItemSchema>

export const CollectionItemInputSchema = CollectionItemSchema.omit({ id: true })
export type CollectionItemInput = z.infer<typeof CollectionItemInputSchema>

export function toCollectionItemInput(item: CollectionItem): CollectionItemInput {
  const { id: _id, ...rest } = item
  return rest
}

export const ShelfSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number().int().default(0),
  accent: z.string().default(''),
})
export type Shelf = z.infer<typeof ShelfSchema>

export const ShelfInputSchema = ShelfSchema.omit({ id: true })
export type ShelfInput = z.infer<typeof ShelfInputSchema>

/** The shape written to disk by the file sync and by Export. */
export const ArchiveFileSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  items: z.array(CollectionItemSchema),
  shelves: z.array(ShelfSchema),
})
export type ArchiveFile = z.infer<typeof ArchiveFileSchema>

/**
 * A blank item, built by letting Zod apply every field default. Deriving it
 * this way means new schema fields can never be forgotten here — the parse
 * fills them in, so the form and the seed path stay in step automatically.
 */
export function emptyCollectionItemInput(): CollectionItemInput {
  // Title is filled in afterwards rather than parsed: the schema requires a
  // non-empty title for a *saved* record, but a blank form is a legitimate
  // draft. Parsing the rest still means a newly added schema field cannot be
  // forgotten here.
  return {
    ...CollectionItemInputSchema.omit({ title: true }).parse({
      type: 'cd',
      year: new Date().getFullYear(),
    }),
    title: '',
  }
}
