/**
 * One-off maintenance script: fills the seed collection in src/data/collection.json
 * with real pressing data and artwork from MusicBrainz and the Cover Art Archive.
 *
 * Run with: node scripts/enrich-collection.mjs [--force]
 *
 * Skips anything that already has a cover unless --force is passed. Films are
 * left alone: MusicBrainz does not carry them, and TMDB needs a key.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const COLLECTION = resolve(HERE, '../src/data/collection.json')
const UA = 'TheArchive/1.0 ( https://github.com/ )'
const force = process.argv.includes('--force')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function mb(path) {
  await sleep(1100) // MusicBrainz rate limit
  const res = await fetch(`https://musicbrainz.org/ws/2${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`MusicBrainz ${res.status} for ${path}`)
  return res.json()
}

async function artwork(mbid) {
  const res = await fetch(`https://coverartarchive.org/release/${mbid}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (res.status === 404) return { front: '', back: '', disc: '' }
  if (!res.ok) return { front: '', back: '', disc: '' }
  const data = await res.json()
  const https = (u) => (u || '').replace(/^http:/, 'https:')
  const pick = (img) => https(img?.thumbnails?.['500'] || img?.image)
  const images = data.images || []
  return {
    front: pick(images.find((i) => i.front) || images.find((i) => i.types?.includes('Front'))),
    back: pick(images.find((i) => i.back) || images.find((i) => i.types?.includes('Back'))),
    disc: pick(images.find((i) => i.types?.includes('Medium'))),
  }
}

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/**
 * Prefers a release that already has cover art and whose format matches what
 * the record says it is — otherwise a CD entry can pick up a vinyl pressing's
 * catalogue number and look wrong to anyone holding the actual case.
 */
function scoreRelease(release, item) {
  let score = 0
  const format = (release.media?.[0]?.format || '').toLowerCase()
  if (item.type === 'cd' && format.includes('cd')) score += 5
  if (item.type === 'vinyl' && format.includes('vinyl')) score += 5
  if (release.date?.startsWith(String(item.year))) score += 4
  if (release['label-info']?.[0]?.label?.name === item.label) score += 3
  if (release.country === 'GB' || release.country === 'US') score += 1
  score += Math.min((release.score || 0) / 25, 4)
  return score
}

const collection = JSON.parse(readFileSync(COLLECTION, 'utf-8'))
let filled = 0
let skipped = 0

const save = () => writeFileSync(COLLECTION, JSON.stringify(collection, null, 2) + '\n')

for (const item of collection) {
  if (item.type === 'dvd') {
    console.log(`  ~  ${item.title} — film, needs TMDB; leaving as is`)
    skipped++
    continue
  }
  if (item.coverImageUrl && !force) {
    console.log(`  ·  ${item.title} — already has art`)
    skipped++
    continue
  }

  try {
    const query = `release:"${item.title}" AND artist:"${item.artistOrDirector}"`
    const search = await mb(`/release/?query=${encodeURIComponent(query)}&fmt=json&limit=15`)
    const candidates = search.releases || []
    if (candidates.length === 0) {
      console.log(`  ?  ${item.title} — no match`)
      skipped++
      continue
    }

    const ranked = candidates.sort((a, b) => scoreRelease(b, item) - scoreRelease(a, item))

    let best = ranked[0]
    let art = await artwork(best.id)
    if (!art.front) {
      for (const candidate of ranked.slice(1, 6)) {
        const alternative = await artwork(candidate.id)
        if (alternative.front) {
          best = candidate
          art = alternative
          break
        }
      }
    }

    const full = await mb(`/release/${best.id}?inc=artist-credits+labels+recordings+genres&fmt=json`)

    const labelInfo = full['label-info']?.[0]
    const tracks = (full.media || []).flatMap((m) =>
      (m.tracks || []).map((t) => ({
        position: t.position ?? 0,
        title: t.title ?? '',
        lengthMs: typeof t.length === 'number' ? t.length : null,
      })),
    )
    const topGenre = [...(full.genres || [])].sort((a, b) => (b.count || 0) - (a.count || 0))[0]

    item.musicbrainzId = full.id
    item.barcode = full.barcode || ''
    item.catalogNumber = labelInfo?.['catalog-number'] || ''
    item.country = full.country || ''
    if (labelInfo?.label?.name) item.label = labelInfo.label.name
    if (full.media?.[0]?.format) {
      item.format = full.media.length > 1 ? `${full.media.length}×${full.media[0].format}` : full.media[0].format
    }
    if (topGenre?.name && !item.genre) item.genre = titleCase(topGenre.name)
    if (tracks.length) item.trackList = tracks
    if (art.front) {
      item.coverImageUrl = art.front
      item.backgroundImageUrl = art.back || art.front
    }
    if (art.back) item.backCoverImageUrl = art.back
    if (art.disc) item.discImageUrl = art.disc

    console.log(
      `  ✓  ${item.title} — ${full.country || '??'} ${full.media?.[0]?.format || ''} ` +
      `${item.catalogNumber || ''} ${tracks.length} tracks ${art.front ? '+art' : '(no art)'}`,
    )
    filled++
    save()
  } catch (err) {
    console.log(`  !  ${item.title} — ${err.message}`)
    skipped++
  }
}

save()
console.log(`\nEnriched ${filled}, skipped ${skipped}. Written to src/data/collection.json`)
