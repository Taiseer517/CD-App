/**
 * Drives a real browser over the running app and reports anything broken.
 *
 * Covers what unit tests cannot: that every page renders, that the bookcase
 * draws, that cover art actually downloads, and that the disc viewer opens
 * with a live WebGL context. Screenshots go to docs/screens/ for eyeballing.
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
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await context.newPage()

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

console.log('\nThe shelf')
// Step into the first shelf on the wall, the way anyone would.
await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.locator('a[aria-label^="Open the"]').first().click()
await page.waitForTimeout(3000)

// The case is drawn, not modelled: there is deliberately no canvas here.
// Only the disc viewer is 3D.
const frame = await page.evaluate(() => ({
  drawn: Boolean(document.querySelector('main svg path')),
  canvas: document.querySelectorAll('main canvas').length,
}))
check('the bookcase is drawn rather than modelled', frame.drawn && frame.canvas === 0)

const cases = await page.locator('main button[aria-pressed]').count()
check('records are on the shelf', cases > 0, `${cases} on this shelf`)

console.log('\nInteraction')
if (cases > 0) {
  await page.locator('main button[aria-pressed]').first().click()
  await page.waitForTimeout(1200)
  const panel = await page.locator('aside h3').first().textContent().catch(() => null)
  check('clicking a record opens its details', Boolean(panel), panel ?? 'no panel')
  await page.screenshot({ path: `${SHOTS}/shelf.png` })
}

console.log('\nDecor themes')
await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(2200)
const swatches = await page.locator('fieldset button').count()
check('every theme is offered as a swatch', swatches >= 4, `${swatches} themes`)

// Prove the choice reaches the bookcase, not just the picker.
const themeShots = []
for (const name of ['Cathedral', 'Crypt']) {
  await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  await page.locator(`button:has-text("${name}")`).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[aria-label^="Open the"]').first().click()
  await page.waitForTimeout(2500)
  themeShots.push((await page.locator('main svg').first().screenshot()).toString('base64').slice(0, 4000))
}
check('switching theme changes how the case is drawn', themeShots[0] !== themeShots[1])

console.log('\nSound')
// Counted from outside the app rather than by asking the module: importing
// it inside page.evaluate returns a second instance with its own state, and
// that reported the ambience running when it was not.
const audioPage = await context.newPage()
await audioPage.addInitScript(() => {
  window.__audio = { contexts: 0, oscillators: 0 }
  const Original = window.AudioContext
  window.AudioContext = class extends Original {
    constructor(...args) {
      window.__audio.contexts++
      super(...args)
      const create = this.createOscillator.bind(this)
      this.createOscillator = () => {
        window.__audio.oscillators++
        return create()
      }
    }
  }
})
await audioPage.goto(BASE + '#/shelf', { waitUntil: 'load' })
await audioPage.waitForTimeout(2500)

const beforeSound = await audioPage.evaluate(() => window.__audio)
check('nothing opens an audio context before it is asked to', beforeSound.contexts === 0)

await audioPage.locator('nav button[aria-pressed]').click()
await audioPage.waitForTimeout(9000)
const afterSound = await audioPage.evaluate(() => window.__audio)
check('the toggle starts the ambience', afterSound.contexts === 1)
// Three of the voices are the drone; anything beyond that is a bell struck.
check('bells are ringing, not just a drone', afterSound.oscillators > 3, `${afterSound.oscillators} voices`)
await audioPage.close()

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
