/**
 * Rebuilds src/data/collection.json so that every value in it came from a
 * source that can be checked.
 *
 * This script previously only filled empty fields, which meant the invented
 * genres shipped in the first commit — "Extreme Gothic Metal", "Silent
 * Horror" — were never replaced by the real ones. It now *overwrites*
 * everything a source can speak to, and clears the fields that are Zarin's to
 * write rather than anyone's to guess.
 *
 *   node scripts/enrich-collection.mjs
 *
 * Films need a TMDB key; pass it as TMDB_KEY or put it in .env.local.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const COLLECTION = resolve(HERE, '../src/data/collection.json')
const UA = 'ZarinsArchive/1.0 ( https://github.com/ )'

function tmdbKey() {
  if (process.env.TMDB_KEY) return process.env.TMDB_KEY
  const envFile = resolve(HERE, '../.env.local')
  if (!existsSync(envFile)) return ''
  return /VITE_TMDB_KEY\s*=\s*(\S+)/.exec(readFileSync(envFile, 'utf-8'))?.[1] ?? ''
}
const TMDB = tmdbKey()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** MusicBrainz answers 503 often enough that a single attempt is not a test. */
async function mb(path) {
  const delays = [1200, 2500, 5000, 9000]
  for (let attempt = 0; ; attempt++) {
    await sleep(1100)
    const res = await fetch(`https://musicbrainz.org/ws/2${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (res.ok) return res.json()
    if (res.status === 503 && attempt < delays.length) {
      await sleep(delays[attempt])
      continue
    }
    throw new Error(`MusicBrainz ${res.status}`)
  }
}

async function tmdb(path, params = {}) {
  if (!TMDB) throw new Error('no TMDB key')
  const query = new URLSearchParams({ api_key: TMDB, ...params })
  const res = await fetch(`https://api.themoviedb.org/3${path}?${query}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

async function artwork(mbid) {
  const res = await fetch(`https://coverartarchive.org/release/${mbid}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) return { front: '', back: '', disc: '' }
  const data = await res.json()
  const https = (u) => (u || '').replace(/^http:/, 'https:')
  const pick = (img) => https(img?.thumbnails?.['500'] || img?.image)
  const images = data.images || []
  const back = images.find((i) => i.back) || images.find((i) => i.types?.includes('Back'))
  const disc = images.find((i) => i.types?.includes('Medium'))
  const front =
    images.find((i) => i.front) ||
    images.find((i) => i.types?.includes('Front')) ||
    images.find((i) => i !== back && i !== disc)
  return { front: pick(front), back: pick(back), disc: pick(disc) }
}

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/**
 * Prefers a release that matches the medium the record says it is, and that
 * somebody catalogued properly — otherwise a CD entry can pick up a vinyl
 * pressing's catalogue number and look wrong to anyone holding the case.
 */
function scoreRelease(release, item) {
  let score = 0
  const format = (release.media?.[0]?.format || '').toLowerCase()
  if (item.type === 'cd' && format.includes('cd')) score += 5
  if (item.type === 'vinyl' && format.includes('vinyl')) score += 5
  if (release.date?.startsWith(String(item.year))) score += 4
  if (release.country) score += 1
  score += Math.min((release.score || 0) / 25, 4)
  return score
}

/** Fields that are hers to write. Nothing may invent them. */
const PERSONAL = {
  rating: 0,
  notes: '',
  conditionOrEdition: '',
  dateAcquired: '',
}

const collection = JSON.parse(readFileSync(COLLECTION, 'utf-8'))
const save = () => writeFileSync(COLLECTION, JSON.stringify(collection, null, 2) + '\n')

let sourced = 0
let skipped = 0

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]?.toLowerCase()
  : ''

for (const item of collection) {
  if (only && !item.title.toLowerCase().includes(only)) continue
  Object.assign(item, PERSONAL)

  try {
    if (item.type === 'dvd') {
      if (!TMDB) {
        console.log(`  ~  ${item.title} — no TMDB key; leaving unsourced fields blank`)
        item.genre = ''
        item.tags = []
        skipped++
        continue
      }

      // Re-fetch by the id already on the record when there is one. Searching
      // again on every run is not idempotent: run one matched "Nosferatu" to
      // the 2024 remake and wrote its year onto the record, after which run
      // two searched for a 1922 film using the year 2024 and confirmed the
      // wrong answer. An id cannot drift like that.
      let filmId = item.tmdbId
      if (!filmId) {
        const search = await tmdb('/search/movie', {
          query: item.title,
          ...(item.year ? { year: String(item.year) } : {}),
        })
        const results = search.results || []
        const hit =
          results.find((r) => (r.release_date || '').startsWith(String(item.year))) || results[0]
        if (!hit) {
          console.log(`  ?  ${item.title} — no film matched`)
          item.genre = ''
          item.tags = []
          skipped++
          continue
        }
        filmId = String(hit.id)
      }

      const film = await tmdb(`/movie/${filmId}`, { append_to_response: 'credits' })
      const director = (film.credits?.crew || []).find((c) => c.job === 'Director')?.name || ''
      const year = Number.parseInt((film.release_date || '').slice(0, 4), 10)

      item.artistOrDirector = director
      item.year = Number.isFinite(year) ? year : item.year
      item.genre = film.genres?.[0]?.name || ''
      item.tags = (film.genres || []).slice(1).map((g) => g.name)
      item.synopsis = film.overview || ''
      item.runtimeMinutes = film.runtime || 0
      item.cast = (film.credits?.cast || []).slice(0, 8).map((c) => c.name)
      item.coverImageUrl = film.poster_path
        ? `https://image.tmdb.org/t/p/w500${film.poster_path}`
        : ''
      item.backgroundImageUrl = film.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${film.backdrop_path}`
        : item.coverImageUrl
      item.backCoverImageUrl = ''
      item.discImageUrl = ''
      item.tmdbId = String(film.id)
      item.sourceName = 'TMDB'
      item.sourceUrl = `https://www.themoviedb.org/movie/${film.id}`

      console.log(
        `  ✓  ${item.title} — ${director || 'no director'}, ${item.genre || 'no genre'}, ` +
          `${item.cast.length} cast ${item.coverImageUrl ? '+poster' : '(no poster)'}`,
      )
      sourced++
      save()
      continue
    }

    // An mbid already on the record is authoritative — re-fetch it rather
    // than searching again and risking a different pressing each run.
    let best
    let art
    if (item.musicbrainzId) {
      best = { id: item.musicbrainzId }
      art = await artwork(best.id)
    } else {
      const query = `release:"${item.title}" AND artist:"${item.artistOrDirector}"`
      const search = await mb(`/release/?query=${encodeURIComponent(query)}&fmt=json&limit=15`)
      const candidates = search.releases || []
      if (candidates.length === 0) {
        console.log(`  ?  ${item.title} — no release matched`)
        item.genre = ''
        item.tags = []
        skipped++
        continue
      }

      const ranked = candidates.sort((a, b) => scoreRelease(b, item) - scoreRelease(a, item))

      // Walk down the ranking until one has cover art: a pressing with no scan
      // is worse for a visual shelf than a near neighbour that has one.
      best = ranked[0]
      art = await artwork(best.id)
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
    }

    const full = await mb(
      `/release/${best.id}?inc=artist-credits+labels+recordings+genres+tags+release-groups&fmt=json`,
    )

    // Genres are voted on the release *group* far more often than on an
    // individual pressing — the release for Cruelty and the Beast carries
    // none at all, while its group carries four. Falling back to the group is
    // still properly sourced, and it is the difference between the field
    // being useful and being half empty.
    let groupGenres = []
    let groupTags = []
    const groupId = full['release-group']?.id
    if (groupId) {
      try {
        const group = await mb(`/release-group/${groupId}?inc=genres+tags&fmt=json`)
        groupGenres = group.genres || []
        groupTags = group.tags || []
      } catch {
        // A missing group is not worth failing the record over.
      }
    }
    const labelInfo = full['label-info']?.[0]
    const tracks = (full.media || []).flatMap((m, index) =>
      (m.tracks || []).map((t) => ({
        position: t.position ?? 0,
        title: t.title ?? '',
        lengthMs: typeof t.length === 'number' ? t.length : null,
        disc: index + 1,
      })),
    )
    const byVotes = (a, b) => (b.count || 0) - (a.count || 0)

    // Every assignment below is unconditional. The previous version only
    // filled blanks, which is exactly how the invented genres survived.
    item.artistOrDirector = (full['artist-credit'] || []).map((a) => a.name).join(' ') || item.artistOrDirector
    item.label = labelInfo?.label?.name || ''
    item.catalogNumber = labelInfo?.['catalog-number'] || ''
    item.barcode = full.barcode || ''
    item.country = full.country || ''
    const genres = [...(full.genres || []), ...groupGenres].sort(byVotes)
    item.genre = genres[0]?.name ? titleCase(genres[0].name) : ''

    // Tags that merely restate the genre add nothing to a shelf label.
    const seen = new Set([item.genre.toLowerCase()])
    item.tags = [...(full.tags || []), ...groupTags]
      .sort(byVotes)
      .map((t) => titleCase(t.name))
      .filter((tag) => {
        const key = tag.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 4)
    item.trackList = tracks
    item.musicbrainzId = full.id
    item.sourceName = 'MusicBrainz'
    item.sourceUrl = `https://musicbrainz.org/release/${full.id}`

    const year = Number.parseInt((full.date || '').slice(0, 4), 10)
    if (Number.isFinite(year)) item.year = year
    if (full.media?.[0]?.format) {
      item.format =
        full.media.length > 1
          ? `${full.media.length}×${full.media[0].format}`
          : full.media[0].format
    }
    item.coverImageUrl = art.front
    item.backgroundImageUrl = art.back || art.front
    item.backCoverImageUrl = art.back
    item.discImageUrl = art.disc

    console.log(
      `  ✓  ${item.title} — ${item.country || '??'} ${item.format || ''} ${item.catalogNumber || ''} ` +
        `genre=${item.genre || '—'} tags=${item.tags.length} ${tracks.length} tracks ` +
        `${art.front ? '+art' : '(no art)'}`,
    )
    sourced++
    save()
  } catch (err) {
    console.log(`  !  ${item.title} — ${err.message}`)
    skipped++
  }
}

save()

// The fill-rate report decides whether a field earns its place in the UI:
// a column blank for most records is noise, not information.
console.log(`\nSourced ${sourced}, skipped ${skipped}.\n`)
console.log('Fill rates:')
const FILM_ONLY = new Set(['synopsis', 'cast', 'runtimeMinutes'])
const films = collection.filter((item) => item.type === 'dvd')

for (const field of [
  'genre', 'tags', 'label', 'catalogNumber', 'barcode', 'country', 'format',
  'trackList', 'coverImageUrl', 'backCoverImageUrl', 'discImageUrl',
  'synopsis', 'cast', 'runtimeMinutes',
]) {
  // A field only films can have is judged against films alone.
  const scope = FILM_ONLY.has(field) ? films : collection
  if (scope.length === 0) continue

  const filled = scope.filter((item) => {
    const value = item[field]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  }).length
  const pct = Math.round((filled / scope.length) * 100)
  const of = FILM_ONLY.has(field) ? 'films' : 'records'
  const verdict = pct >= 50 ? '' : '   <- below half; consider dropping from the UI'
  console.log(
    `  ${field.padEnd(20)} ${String(filled).padStart(3)}/${String(scope.length).padEnd(3)} ${String(pct).padStart(3)}% of ${of}${verdict}`,
  )
}
