import { chromium } from 'playwright'
const log = (m) => console.log(`[${new Date().toISOString().slice(14,23)}] ${m}`)
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

log('goto shelf'); await page.goto('http://localhost:5173/#/shelf', { waitUntil: 'load' })
await page.waitForTimeout(9000); log('shelf settled')

log('goto wishlist')
await page.goto('http://localhost:5173/#/wishlist', { waitUntil: 'commit', timeout: 15000 })
log('navigated')

log('count canvases')
const n = await page.evaluate(() => document.querySelectorAll('canvas').length).catch(e => 'EVAL FAILED ' + e.message.slice(0,60))
log('canvases: ' + n)

log('read body text')
const t = await page.locator('main').innerText({ timeout: 8000 }).catch(e => 'FAILED ' + e.message.slice(0,50))
log('body: ' + String(t).replace(/\s+/g,' ').slice(0, 60))

log('screenshot with animations disabled')
await page.screenshot({ path: '/tmp/shots/wl.png', timeout: 15000, animations: 'disabled' })
  .then(() => log('screenshot OK'))
  .catch(e => log('screenshot FAILED: ' + e.message.split('\n')[0]))

await browser.close(); log('done')
