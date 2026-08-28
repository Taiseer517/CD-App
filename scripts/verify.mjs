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
  if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`)
})

const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) problems.push(`failed check: ${label} ${detail}`)
}

console.log('\nPages')
for (const [name, hash] of [
  ['collection', '#/'],
  ['shelf', '#/shelf'],
  ['wishlist', '#/wishlist'],
  ['stats', '#/stats'],
  ['admin', '#/admin'],
  ['add', '#/admin/new'],
]) {
  await page.goto(BASE + hash, { waitUntil: 'load' })
  await page.waitForTimeout(name === 'shelf' ? 9000 : 1500)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
  const text = await page.locator('main').innerText()
  check(name, text.trim().length > 40, `${text.replace(/\s+/g, ' ').slice(0, 46)}…`)
}

console.log('\nThe 3D scene')
await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(9000)

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
await page.waitForTimeout(9000)
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

console.log('\n' + (problems.length ? `${problems.length} problem(s):\n` + [...new Set(problems)].join('\n') : 'All checks passed.'))
await browser.close()
process.exit(problems.length ? 1 : 0)
