// Deterministic frame renderer for the ACKS promo.
//
// The page in src/index.html exposes window.renderFrame(t). Nothing on the page
// animates on its own (no CSS transitions, no requestAnimationFrame), so every
// frame is a pure function of t and frames can be captured in parallel.
//
//   node scripts/render.mjs                 render every frame to frames/
//   node scripts/render.mjs --stills 1,4.5  render single frames to output/preview/
//   node scripts/render.mjs --cues          write the sound cue list to .cache/cues.json
//   node scripts/render.mjs --workers 2 --from 300 --to 600

import { createServer } from 'node:http'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FPS = 30
const DURATION = 45
const TOTAL_FRAMES = FPS * DURATION

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

function serve() {
  const server = createServer(async (request, response) => {
    const path = normalize(
      decodeURIComponent(new URL(request.url, 'http://x').pathname),
    )
    const file = join(ROOT, path)
    if (!file.startsWith(ROOT)) {
      response.writeHead(403).end()
      return
    }
    try {
      const body = await readFile(file)
      response.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () => done(server)),
  )
}

async function openPage(browser, url) {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  })
  page.on('pageerror', (error) => console.error('[page error]', error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      console.error('[page]', message.text())
  })
  await page.goto(url)
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 120_000,
  })
  const missing = await page.evaluate(() => window.__missingFonts ?? [])
  if (missing.length) throw new Error(`fonts not loaded: ${missing.join(', ')}`)
  // Raw CDP capture: still lossless PNG, but with fast (low-effort) compression.
  page.cdp = await page.context().newCDPSession(page)
  return page
}

async function capture(page, t, path) {
  await page.evaluate((time) => window.renderFrame(time), t)
  const { data } = await page.cdp.send('Page.captureScreenshot', {
    format: 'png',
    optimizeForSpeed: true,
  })
  await writeFile(path, Buffer.from(data, 'base64'))
}

const server = await serve()
const url = `http://127.0.0.1:${server.address().port}/src/index.html`
const browser = await chromium.launch()

try {
  const stills = option('stills', null)
  if (args.includes('--cues')) {
    const page = await openPage(browser, url)
    const cues = await page.evaluate(() => window.__cues)
    await mkdir(join(ROOT, '.cache'), { recursive: true })
    const path = join(ROOT, '.cache', 'cues.json')
    await writeFile(path, `${JSON.stringify(cues, null, 2)}\n`)
    console.log(`${path} (${cues.length} cues)`)
  } else if (stills) {
    const outDir = join(ROOT, 'output', 'preview')
    await mkdir(outDir, { recursive: true })
    const page = await openPage(browser, url)
    for (const value of stills.split(',')) {
      const t = Number(value)
      const path = join(outDir, `t${t.toFixed(2).padStart(5, '0')}.png`)
      await capture(page, t, path)
      console.log(path)
    }
  } else {
    const workers = Number(option('workers', 4))
    const from = Number(option('from', 0))
    const to = Number(option('to', TOTAL_FRAMES))
    const outDir = join(ROOT, 'frames')
    if (from === 0 && to === TOTAL_FRAMES)
      await rm(outDir, { recursive: true, force: true })
    await mkdir(outDir, { recursive: true })

    let next = from
    let done = 0
    const started = Date.now()
    const work = async () => {
      const page = await openPage(browser, url)
      while (next < to) {
        const frame = next++
        await capture(
          page,
          frame / FPS,
          join(outDir, `${String(frame).padStart(5, '0')}.png`),
        )
        done++
        if (done % 90 === 0) {
          const rate = done / ((Date.now() - started) / 1000)
          console.log(`${done}/${to - from} frames · ${rate.toFixed(1)} fps`)
        }
      }
    }
    await Promise.all(Array.from({ length: workers }, work))
    console.log(
      `rendered ${done} frames in ${((Date.now() - started) / 1000).toFixed(1)} s`,
    )
  }
} finally {
  await browser.close()
  server.close()
}
