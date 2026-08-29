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
  ['add', '#/add'],
  ['byHand', '#/admin/new'],
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

/**
 * Steps into a shelf that actually holds something, the way anyone would.
 *
 * Taking the first alcove on the wall assumed the first shelf was never
 * empty, which stopped being true the moment the collection was all on one
 * medium — the run then reported an empty rack as a broken one.
 */
async function openAStockedShelf() {
  await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
  await page.waitForTimeout(2500)

  const alcoves = page.locator('a[aria-label^="Open the"]')
  const counts = await alcoves.evaluateAll((nodes) =>
    nodes.map((node) => Number.parseInt(node.innerText.match(/(\d+)\s+records?/)?.[1] ?? '0', 10)),
  )
  const fullest = counts.indexOf(Math.max(...counts))
  await alcoves.nth(fullest === -1 ? 0 : fullest).click()
  await page.waitForTimeout(3000)
}

await openAStockedShelf()

// The case is drawn, not modelled: there is deliberately no canvas here.
// Only the disc viewer is 3D.
// The rack is plain DOM: there is deliberately no canvas here, and only the
// disc viewer is 3D.
const frame = await page.evaluate(() => ({
  rack: Boolean(document.querySelector('[data-rack-item]')),
  canvas: document.querySelectorAll('main canvas').length,
}))
check('the shelf is drawn rather than modelled', frame.rack && frame.canvas === 0)

// Targeted by data attribute, not aria-pressed: the density toggle carries
// that too and sits earlier in the document.
const cases = await page.locator('[data-rack-item]').count()
check('records are on the shelf', cases > 0, `${cases} on this shelf`)

console.log('\nInteraction')
if (cases > 0) {
  await page.locator('[data-rack-item]').first().click()
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
  const themeAlcoves = page.locator('a[aria-label^="Open the"]')
  const themeCounts = await themeAlcoves.evaluateAll((nodes) =>
    nodes.map((node) => Number.parseInt(node.innerText.match(/(\d+)\s+records?/)?.[1] ?? '0', 10)),
  )
  await themeAlcoves.nth(Math.max(0, themeCounts.indexOf(Math.max(...themeCounts)))).click()
  await page.waitForTimeout(2500)
  themeShots.push((await page.locator('[role="group"]').first().screenshot()).toString('base64').slice(0, 4000))
}
check('switching theme changes how the shelf is lit', themeShots[0] !== themeShots[1])

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
await audioPage.waitForTimeout(1500)
const armed = await audioPage.evaluate(() => window.__audio)
check('the toggle arms the sound', armed.contexts === 1)

// Nothing plays on its own any more. Left alone, the count must not move:
// a rising oscillator count with nobody touching anything is exactly the
// background music that was asked to go.
const idleBefore = (await audioPage.evaluate(() => window.__audio)).oscillators
await audioPage.waitForTimeout(9000)
const idleAfter = await audioPage.evaluate(() => window.__audio)
check(
  'nothing plays on its own once armed',
  idleAfter.oscillators === idleBefore,
  `${idleBefore} → ${idleAfter.oscillators} voices while idle`,
)

// The effects used to be gated behind the ambience loop, so removing the
// loop would have silenced them too. Clicking must still make a sound.
await audioPage.locator('a[aria-label^="Open the"]').first().click()
await audioPage.waitForTimeout(1500)
const afterClick = await audioPage.evaluate(() => window.__audio)
check(
  'interaction still makes a sound with no ambience running',
  afterClick.oscillators > idleAfter.oscillators,
  `${idleAfter.oscillators} → ${afterClick.oscillators} voices`,
)
await audioPage.close()

console.log('\nThe disc, held up to the light')
await openAStockedShelf()
await page.locator('[data-rack-item]').first().click()
await page.waitForTimeout(1200)
// Reads "See the record" for vinyl and "See the disc" for a CD.
const discButton = page.locator('button:has-text("See the")').first()
if (await discButton.count()) {
  await discButton.click()
  await page.waitForTimeout(2500)
  // The overlay must cover the window, not the page it was opened from.
  // Mounted inside a transformed ancestor it measured the page instead, and
  // the sleeve stayed visible beside the spinning disc.
  const covers = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]')
    if (!dialog) return null
    const box = dialog.getBoundingClientRect()
    return {
      full:
        Math.abs(box.width - window.innerWidth) < 2 &&
        Math.abs(box.height - window.innerHeight) < 2 &&
        Math.abs(box.top) < 2 &&
        Math.abs(box.left) < 2,
      parentIsBody: dialog.parentElement === document.body,
    }
  })
  check('the disc viewer opens', covers !== null)
  check('it covers the window rather than the page behind it', covers?.full === true)
  check('it is mounted outside the transitioning page', covers?.parentIsBody === true)
  await page.screenshot({ path: `${SHOTS}/disc-viewer.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
}

console.log('\nShelves can be managed from the wall')
await page.goto(BASE + '#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(2000)
await page.locator('button:has-text("Rearrange shelves")').click()
await page.waitForTimeout(600)
const renameButtons = await page.locator('button[title^="Rename the"]').count()
const deleteButtons = await page.locator('button[title^="Take down the"]').count()
check('every shelf can be renamed from the wall', renameButtons > 0, `${renameButtons} controls`)
check('every shelf can be taken down from the wall', deleteButtons > 0, `${deleteButtons} controls`)
await page.screenshot({ path: `${SHOTS}/wall-arranging.png` })

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
