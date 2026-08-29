/**
 * Builds src/data/collection.json from the list below, from scratch.
 *
 * The list is what Zarin actually owns. Everything else on each record — the
 * pressing, the label, the catalogue number, the tracklist, the artwork, the
 * annotation where an editor has written one — is fetched from MusicBrainz
 * and the Cover Art Archive and written as it comes back. Nothing is composed
 * to fill a gap: a field the source has nothing for is left empty, and the
 * fill-rate report at the end says how empty.
 *
 * Rating, notes, condition and date acquired are never written at all. Those
 * are hers.
 *
 *   node scripts/build-collection.mjs
 *   node scripts/build-collection.mjs --only opeth
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const COLLECTION = resolve(HERE, '../src/data/collection.json')
const UA = 'ZarinsArchive/1.0 ( https://github.com/ )'

/**
 * All held on vinyl. The medium is her word rather than the catalogue's, so
 * it is stated here and a vinyl pressing is preferred when one is catalogued;
 * where none is, the record still stands as vinyl and the run says so.
 */
const OWNED = [
  { title: 'Still Life', artist: 'Opeth' },
  { title: 'Blackwater Park', artist: 'Opeth' },
  { title: 'Deliverance', artist: 'Opeth' },
  { title: 'Watershed', artist: 'Opeth' },
  { title: 'Heritage', artist: 'Opeth' },
  { title: 'Ghost Reveries', artist: 'Opeth' },
  { title: 'Of Mourning', artist: 'Psychonaut 4' },
  { title: 'Lonely People With Power', artist: 'Deafheaven' },
  { title: 'Alternative 4', artist: 'Anathema' },
  { title: "Serpent's Embrace", artist: 'Agathodaimon' },
  { title: 'And Love Said No', artist: 'HIM' },
]

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
  // Excluding by type, not by identity: a release with two scans of the disc
  // and no sleeve would otherwise shelve the second disc as its cover.
  const unusable = (i) =>
    Boolean(i.back || i.types?.some((t) => t === 'Back' || t === 'Spine' || t === 'Medium'))
  const front =
    images.find((i) => i.front) ||
    images.find((i) => i.types?.includes('Front')) ||
    images.find((i) => i.types?.includes('Booklet')) ||
    images.find((i) => !unusable(i))
  return { front: pick(front), back: pick(back), disc: pick(disc) }
}

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/**
 * Annotations are written in MusicBrainz's own wiki markup, so they arrive
 * carrying '''bold''' and [http://…|link] and would be read literally. The
 * words are not touched — only the scaffolding around them is taken off.
 */
function plainText(annotation) {
  const cleaned = (annotation || '')
    .replace(/\[(?:https?:)?[^\]|]*\|([^\]]*)\]/g, '$1') // [url|label] -> label
    .replace(/\[((?:https?:)?\/\/[^\]]*)\]/g, '') // a bare [url] says nothing
    .replace(/'''([^']*)'''/g, '$1')
    .replace(/''([^']*)''/g, '$1')
    .replace(/^\s*={2,}\s*(.*?)\s*={2,}\s*$/gm, '$1')
    .replace(/^\s*\*\s?/gm, '· ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Long enough to say something, short enough to still be a note beside a
  // record rather than an essay. Cut at a sentence so it never stops mid-word.
  if (cleaned.length <= 420) return cleaned
  const window = cleaned.slice(0, 420)
  const stop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'))
  return (stop > 160 ? window.slice(0, stop + 1) : window).trim() + ' […]'
}
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Ranks the pressings of one album, the album itself already settled. She
 * owns these on vinyl, so a vinyl pressing is the right catalogue entry; a
 * download is not a thing that can sit on a shelf and ranks below everything.
 */
function score(release) {
  const format = (release.media || []).map((m) => m.format || '').join(' ').toLowerCase()
  let value = 0

  if (format.includes('vinyl')) value += 20
  if (format.includes('digital') || format.includes('file')) value -= 25

  if ((release.status || '') === 'Official') value += 6
  if (release.date) value += 2
  if (release.country) value += 1
  if (release.barcode) value += 1
  if (release['label-info']?.[0]?.['catalog-number']) value += 1

  return value
}

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]?.toLowerCase()
  : ''

const wanted = only
  ? OWNED.filter((entry) => `${entry.title} ${entry.artist}`.toLowerCase().includes(only))
  : OWNED

// Keeps whatever is already catalogued for records not being rebuilt in this
// run, so --only is a repair rather than a wipe.
const existing = only ? JSON.parse(readFileSync(COLLECTION, 'utf-8')) : []
const collection = existing.filter(
  (item) => !wanted.some((entry) => norm(entry.title) === norm(item.title)),
)

const save = () =>
  writeFileSync(COLLECTION, JSON.stringify(collection, null, 2) + '\n')

let built = 0
const noVinyl = []
const missing = []

for (const want of wanted) {
  try {
    // The album first, then its pressings — not a free-text hunt through
    // every release ever made. Searching "Deliverance Opeth" flat returns
    // sixty rows of other people's records called Deliverance and not one
    // Opeth pressing; asking which album is meant, and only then which copy,
    // is both more accurate and how the question is actually shaped.
    const rgQuery = `releasegroup:"${want.title}" AND artist:"${want.artist}"`
    const rgSearch = await mb(
      `/release-group/?query=${encodeURIComponent(rgQuery)}&fmt=json&limit=25`,
    )
    const groups = (rgSearch['release-groups'] || []).filter((group) =>
      norm((group['artist-credit'] || []).map((a) => a.name).join(' ')).includes(norm(want.artist)),
    )
    // An album outranks a single of the same name. "And Love Said No" is both
    // a HIM single and the record named after it, and the single is the exact
    // title match — so matching on title alone picks the wrong one every time.
    const rank = (g) => {
      let value = 0
      if (g['primary-type'] === 'Album') value += 20
      if (g['primary-type'] === 'Single') value -= 15
      if (g['primary-type'] === 'EP') value -= 8
      if (norm(g.title) === norm(want.title)) value += 8
      else if (norm(g.title).startsWith(norm(want.title))) value += 5
      if ((g['secondary-types'] || []).includes('Live')) value -= 10
      return value
    }
    const group = [...groups].sort((a, b) => rank(b) - rank(a))[0]

    if (!group) {
      console.log(`  ?  ${want.title} — no release group matched`)
      missing.push(want.title)
      continue
    }

    const browse = await mb(
      `/release?release-group=${group.id}&inc=artist-credits+labels+media&fmt=json&limit=100`,
    )
    const candidates = browse.releases || []

    if (candidates.length === 0) {
      console.log(`  ?  ${want.title} — the album is catalogued but has no releases`)
      missing.push(want.title)
      continue
    }

    const ranked = candidates.sort((a, b) => score(b) - score(a))

    // Walk the ranking for one that actually has a scan: a pressing with no
    // cover is worse on a visual shelf than its near neighbour that has one.
    let best = ranked[0]
    let art = await artwork(best.id)
    if (!art.front) {
      for (const candidate of ranked.slice(1, 10)) {
        const alternative = await artwork(candidate.id)
        if (alternative.front) {
          best = candidate
          art = alternative
          break
        }
      }
    }

    const full = await mb(
      `/release/${best.id}?inc=artist-credits+labels+recordings+genres+tags+annotation+release-groups&fmt=json`,
    )

    // Genres are voted on the release *group* far more often than on any one
    // pressing, so the group is a fallback rather than a different claim.
    let groupGenres = []
    let groupTags = []
    let groupAnnotation = ''
    const groupId = full['release-group']?.id
    if (groupId) {
      try {
        const group = await mb(`/release-group/${groupId}?inc=genres+tags+annotation&fmt=json`)
        groupGenres = group.genres || []
        groupTags = group.tags || []
          groupAnnotation = (group.annotation || '').trim()
      } catch {
        // A missing group is not worth failing the record over.
      }
    }

    const labelInfo = full['label-info']?.[0]
    const byVotes = (a, b) => (b.count || 0) - (a.count || 0)
    const genres = [...(full.genres || []), ...groupGenres].sort(byVotes)
    const genre = genres[0]?.name ? titleCase(genres[0].name) : ''

    const seen = new Set([genre.toLowerCase()])
    const tags = [...genres, ...(full.tags || []), ...groupTags]
      .sort(byVotes)
      .map((t) => titleCase(t.name || ''))
      .filter((tag) => {
        const key = tag.toLowerCase()
        if (!tag || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 6)

    const format = full.media?.[0]?.format
      ? full.media.length > 1
        ? `${full.media.length}×${full.media[0].format}`
        : full.media[0].format
      : ''

    if (!format.toLowerCase().includes('vinyl')) noVinyl.push(`${want.title} (${format || 'unknown'})`)

    const year = Number.parseInt((full.date || '').slice(0, 4), 10)

    collection.push({
      id: `${slug(want.artist)}-${slug(want.title)}`,
      // Hers to state: she owns these on vinyl, whatever pressing the
      // catalogue matched.
      type: 'vinyl',
      title: full.title || want.title,
      artistOrDirector: (full['artist-credit'] || []).map((a) => a.name).join('') || want.artist,
      year: Number.isFinite(year) ? year : 0,
      label: labelInfo?.label?.name || '',
      genre,
      format,
      coverImageUrl: art.front,
      backgroundImageUrl: art.back || art.front,
      backCoverImageUrl: art.back,
      discImageUrl: art.disc,
      dominantColor: '',
      tags,
      // Hers to write, and never guessed.
      rating: 0,
      notes: '',
      conditionOrEdition: '',
      dateAcquired: '',
      wishlist: false,
      shelfId: null,
      position: 0,
      musicbrainzId: full.id,
      tmdbId: '',
      barcode: full.barcode || '',
      catalogNumber: labelInfo?.['catalog-number'] || '',
      country: full.country || '',
      trackList: (full.media || []).flatMap((m, index) =>
        (m.tracks || []).map((t) => ({
          position: t.position ?? 0,
          title: t.title ?? '',
          lengthMs: typeof t.length === 'number' ? t.length : null,
          disc: index + 1,
        })),
      ),
      // Free text an editor wrote about this release. Usually there is none,
      // and none is the honest answer.
      funFact: plainText((full.annotation || '').trim() || groupAnnotation),
      sourceName: 'MusicBrainz',
      sourceUrl: `https://musicbrainz.org/release/${full.id}`,
      synopsis: '',
      cast: [],
      runtimeMinutes: 0,
    })

    const record = collection[collection.length - 1]
    console.log(
      `  ✓  ${record.title} — ${record.artistOrDirector}, ${record.year || '????'} ` +
        `${record.country || '??'} ${record.format || '?'} ${record.catalogNumber || ''} ` +
        `genre=${record.genre || '—'} tags=${record.tags.length} ${record.trackList.length} tracks ` +
        `${art.front ? '+art' : '(no art)'}${record.funFact ? ' +note' : ''}`,
    )
    built++
    save()
  } catch (err) {
    console.log(`  !  ${want.title} — ${err.message}`)
    missing.push(want.title)
  }
}

collection.sort((a, b) => a.artistOrDirector.localeCompare(b.artistOrDirector) || a.year - b.year)
save()

console.log(`\nBuilt ${built} of ${wanted.length}.`)
if (missing.length > 0) console.log(`Nothing matched for: ${missing.join(', ')}`)
if (noVinyl.length > 0) {
  console.log(`\nNo vinyl pressing catalogued, so the format shown is the one that was:`)
  for (const entry of noVinyl) console.log(`  · ${entry}`)
}

console.log('\nFill rates:')
for (const field of [
  'year', 'genre', 'tags', 'label', 'catalogNumber', 'barcode', 'country',
  'format', 'trackList', 'coverImageUrl', 'backCoverImageUrl', 'discImageUrl', 'funFact',
]) {
  const filled = collection.filter((item) => {
    const value = item[field]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  }).length
  const pct = collection.length ? Math.round((filled / collection.length) * 100) : 0
  const verdict = pct >= 50 ? '' : '   <- below half; consider dropping from the UI'
  console.log(
    `  ${field.padEnd(20)} ${String(filled).padStart(2)}/${String(collection.length).padEnd(2)} ${String(pct).padStart(3)}%${verdict}`,
  )
}
