/**
 * Drives a real browser over the running app and reports anything broken.
 *
 * Covers what unit tests cannot: that the WebGL scene actually builds, that
 * cover art reaches the GPU, and that dragging a case between shelves lands in
 * IndexedDB. Screenshots are written to docs/screens/ for eyeballing.
 *
 *   npm run dev              # in one terminal
 *   node scripts/verify.mjs  # in another
 *
 * Pass a base URL to check a production preview instead:
 *   npm run preview
 *   node scripts/verify.mjs http://localhost:4173/the-archive/
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = (process.argv[2] || 'http://localhost:5173/').replace(/\/?$/, '/')
const SHOTS = 'docs/screens'
mkdirSync(SHOTS, { recursive: true })

// SwiftShader lets this run on a machine with no usable GPU, such as CI.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
// A fresh context starts with empty storage, so this exercises a first run.
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

const problems = []
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message.split('\n')[0]}`))
page.on('console', (message) => {
  if (message.type() !== 'error') return
  const text = message.text()
  // Some archive.org mirrors drop the CORS header on a redirect, at random.
  // The app already falls back to a printed label for a sleeve it cannot
  // load, and an external flake is not this project's regression to report.
  if (/archive\.org|ERR_FAILED|Access to image/.test(text)) return
  problems.push(`console: ${text.slice(0, 200)}`)
})

const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) problems.push(`failed check: ${label} ${detail}`)
}

console.log('\nPages')
for (const [name, hash] of [
  ['collection', '#/'],
  ['wall', '#/shelf'],
  ['wishlist', '#/wishlist'],
  ['stats', '#/stats'],
  ['admin', '#/admin'],
  ['add', '#/admin/new'],
]) {
  await page.goto(BASE + hash, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
  const text = await page.locator('main').innerText()
  check(name, text.trim().length > 40, `${text.replace(/\s+/g, ' ').slice(0, 46)}…`)
}

await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(2200)
const alcoves = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Open the"]').length)
check('the wall shows an alcove per shelf', alcoves >= 3, `${alcoves} alcoves`)

console.log('\nThe 3D scene')
// Step into the first shelf on the wall, the way anyone would.
await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.locator('a[aria-label^="Open the"]').first().click()
await page.waitForTimeout(11000)

const gl = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  if (!canvas) return null
  const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
  return context ? { lost: context.isContextLost(), w: canvas.width } : null
})
check('canvas has a live WebGL context', Boolean(gl) && !gl.lost)

// Cover art reaching the GPU is the difference between a shelf of sleeves and
// a shelf of grey slabs, and it fails silently.
const artRequests = []
page.on('response', (res) => {
  if (/coverartarchive|archive\.org/.test(res.url()) && res.status() === 200) artRequests.push(res.url())
})
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(11000)
check('cover art downloaded', artRequests.length > 0, `${artRequests.length} images`)

const readPlacements = () =>
  page.evaluate(async () => {
    const request = indexedDB.open('the-archive')
    const db = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result)
    })
    const read = (store) =>
      new Promise((resolve) => {
        const r = db.transaction(store, 'readonly').objectStore(store).getAll()
        r.onsuccess = () => resolve(r.result)
      })
    const [items, shelves] = await Promise.all([read('items'), read('shelves')])
    const names = new Map(shelves.map((s) => [s.id, s.name]))
    return items
      .filter((i) => !i.wishlist)
      .map((i) => `${i.title} -> ${names.get(i.shelfId) ?? 'Unfiled'} @${i.position}`)
      .sort()
  })

const before = await readPlacements()
check('collection seeded with shelves', before.length > 0 && !before.every((p) => p.includes('Unfiled')))



console.log('\nInteraction')
const box = await page.locator('canvas').boundingBox()

/**
 * Finds a case by probing the canvas rather than trusting fixed coordinates:
 * the bookcase is re-laid-out whenever its furniture changes, and a hard-coded
 * click point silently starts hitting empty shelf instead of failing loudly.
 */
async function findCase() {
  // The scene publishes where each visible case projects to on screen (dev
  // builds only), so the click lands on an actual sleeve rather than on a
  // coordinate that happened to work the day it was written.
  const cases = await page.evaluate(() => window.__archiveCases ?? [])
  if (cases.length === 0) return null
  const target = cases[0]

  await page.mouse.click(target.x, target.y)
  await page.waitForTimeout(1200)
  const title = await page.locator('aside h3').first().textContent().catch(() => null)
  return title ? { x: target.x, y: target.y, title } : null
}

const found = await findCase()
check('clicking a case opens its details', Boolean(found), found?.title ?? 'no case found on the canvas')
await page.screenshot({ path: `${SHOTS}/selected.png` })
await page.locator('aside button[aria-label="Close details"]').click().catch(() => {})
await page.waitForTimeout(800)

if (found) {
  // Drag it downward onto a lower shelf.
  await page.mouse.move(found.x, found.y)
  await page.mouse.down()
  const drop = box.y + box.height * 0.74
  const steps = 14
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(found.x + step * 3, found.y + ((drop - found.y) * step) / steps)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(2200)
}

const after = await readPlacements()
check('dragging a case moves it and persists', JSON.stringify(before) !== JSON.stringify(after))

console.log('\nThe disc viewer')
await page.goto(BASE + '#/', { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.locator('a[href*="#/item/"]').first().click()
await page.waitForTimeout(2000)

const discTrigger = page.locator('button:has-text("See the")').first()
if ((await discTrigger.count()) > 0) {
  await discTrigger.click()
  await page.waitForTimeout(9000)

  const viewer = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const canvas = dialog?.querySelector('canvas')
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl')
    return { open: Boolean(dialog), live: Boolean(gl) && !gl.isContextLost() }
  })
  check('the disc viewer opens with a live canvas', viewer.open && viewer.live)
  await page.screenshot({ path: `${SHOTS}/disc.png` })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(900)
  check(
    'Escape closes the disc viewer',
    (await page.locator('[role="dialog"]').count()) === 0,
  )
} else {
  check('the disc viewer has a trigger', false, 'no "See the…" button found')
}

console.log('\nDecor themes')
await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(2200)
const swatches = await page.locator('fieldset button').count()
check('every theme is offered as a swatch', swatches >= 4, `${swatches} themes`)

// Prove the choice reaches the 3D scene, not just the picker. Screenshots
// are compared rather than the canvas read back: a WebGL buffer is blank
// after the frame unless preserveDrawingBuffer is on, which costs memory
// for nothing but this test.
const themeShots = []
for (const name of ['Cathedral', 'Crypt']) {
  await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  await page.locator(`button:has-text("${name}")`).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[aria-label^="Open the"]').first().click()
  await page.waitForTimeout(10000)
  themeShots.push((await page.locator('canvas').screenshot()).toString('base64').slice(0, 4000))
}
check('switching theme changes what is rendered', themeShots[0] !== themeShots[1])

console.log('\nAttribution')
const footer = await page.locator('footer').innerText()
check('sources are credited', /MusicBrainz/.test(footer) && /Cover Art Archive/.test(footer))
check(
  'TMDB attribution is present, as their terms require',
  !footer.includes('TMDB') || footer.includes('not endorsed or certified by TMDB'),
)

console.log('\n' + (problems.length ? `${problems.length} problem(s):\n` + [...new Set(problems)].join('\n') : 'All checks passed.'))
await browser.close()
process.exit(problems.length ? 1 : 0)
