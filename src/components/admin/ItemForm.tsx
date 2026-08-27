import { useState } from 'react'
import type { CollectionItemInput, MediaType } from '../../data/schema'

interface ItemFormProps {
  initialValues?: CollectionItemInput
  submitLabel: string
  onSubmit: (input: CollectionItemInput) => Promise<void>
  onSaveAndAddAnother?: (input: CollectionItemInput) => Promise<void>
}

const emptyValues: CollectionItemInput = {
  type: 'cd',
  title: '',
  artistOrDirector: '',
  year: new Date().getFullYear(),
  label: '',
  genre: '',
  format: '',
  coverImageUrl: '',
  backgroundImageUrl: '',
  tags: [],
  rating: 0,
  notes: '',
  conditionOrEdition: '',
  dateAcquired: '',
  wishlist: false,
}

const inputClass =
  'w-full rounded-md border border-void-700 bg-void-900 px-3 py-2 text-bone-100 placeholder:text-bone-400/60 focus:border-blood-500 focus:outline-none'
const labelClass = 'block text-xs uppercase tracking-wide text-bone-400 mb-1'

export function ItemForm({ initialValues, submitLabel, onSubmit, onSaveAndAddAnother }: ItemFormProps) {
  const [values, setValues] = useState<CollectionItemInput>(initialValues ?? emptyValues)
  const [tagsText, setTagsText] = useState(initialValues?.tags.join(', ') ?? '')
  const [saving, setSaving] = useState(false)

  function buildPayload(): CollectionItemInput {
    return {
      ...values,
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }
  }

  function update<K extends keyof CollectionItemInput>(key: K, value: CollectionItemInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit(buildPayload())
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndAddAnother() {
    if (!onSaveAndAddAnother) return
    setSaving(true)
    try {
      await onSaveAndAddAnother(buildPayload())
      setValues(emptyValues)
      setTagsText('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="type">Type</label>
          <select
            id="type"
            className={inputClass}
            value={values.type}
            onChange={(event) => update('type', event.target.value as MediaType)}
          >
            <option value="cd">CD</option>
            <option value="dvd">DVD</option>
            <option value="vinyl">Vinyl</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="title">Title</label>
          <input
            id="title"
            required
            className={inputClass}
            value={values.title}
            onChange={(event) => update('title', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="artistOrDirector">Artist / Director</label>
          <input
            id="artistOrDirector"
            className={inputClass}
            value={values.artistOrDirector}
            onChange={(event) => update('artistOrDirector', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="year">Year</label>
          <input
            id="year"
            type="number"
            className={inputClass}
            value={values.year}
            onChange={(event) => update('year', Number(event.target.value))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="label">Label</label>
          <input
            id="label"
            className={inputClass}
            value={values.label}
            onChange={(event) => update('label', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="genre">Genre</label>
          <input
            id="genre"
            className={inputClass}
            value={values.genre}
            onChange={(event) => update('genre', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="format">Format</label>
          <input
            id="format"
            className={inputClass}
            placeholder="Jewel Case, Digipak, LP…"
            value={values.format}
            onChange={(event) => update('format', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="conditionOrEdition">Condition / Edition</label>
          <input
            id="conditionOrEdition"
            className={inputClass}
            value={values.conditionOrEdition}
            onChange={(event) => update('conditionOrEdition', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="dateAcquired">Date acquired</label>
          <input
            id="dateAcquired"
            type="date"
            className={inputClass}
            value={values.dateAcquired}
            onChange={(event) => update('dateAcquired', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rating">Rating (0–5)</label>
          <input
            id="rating"
            type="number"
            min={0}
            max={5}
            className={inputClass}
            value={values.rating}
            onChange={(event) => update('rating', Number(event.target.value))}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="coverImageUrl">Cover image URL</label>
          <input
            id="coverImageUrl"
            className={inputClass}
            value={values.coverImageUrl}
            onChange={(event) => update('coverImageUrl', event.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="backgroundImageUrl">Background image URL</label>
          <input
            id="backgroundImageUrl"
            className={inputClass}
            value={values.backgroundImageUrl}
            onChange={(event) => update('backgroundImageUrl', event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="tags">Tags (comma separated)</label>
        <input
          id="tags"
          className={inputClass}
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          rows={4}
          className={inputClass}
          value={values.notes}
          onChange={(event) => update('notes', event.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-bone-200">
        <input
          type="checkbox"
          checked={values.wishlist}
          onChange={(event) => update('wishlist', event.target.checked)}
        />
        Wishlist item (not yet owned)
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border border-blood-700 bg-blood-900/60 px-5 py-2 text-sm text-bone-100 transition-colors hover:border-blood-400 disabled:opacity-50"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onSaveAndAddAnother && (
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAndAddAnother}
            className="rounded-md border border-velvet-700 px-5 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400 disabled:opacity-50"
          >
            Save and add another
          </button>
        )}
      </div>
    </form>
  )
}
