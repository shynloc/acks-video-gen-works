// Serves this project over HTTP and opens src/index.html in headless Chromium.
// The page exposes window.renderFrame(t), window.__duration and window.__cues,
// and sets window.__ready once fonts and images are loaded.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

export const PROJECT = fileURLToPath(new URL('..', import.meta.url))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

function startServer() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://local').pathname))
    const file = join(PROJECT, path)
    if (!file.startsWith(PROJECT.endsWith(sep) ? PROJECT : PROJECT + sep)) {
      res.writeHead(403).end()
      return
    }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

// Starts the server and browser; returns { open, close }. open() gives a ready page.
export async function launch() {
  const server = await startServer()
  const url = `http://127.0.0.1:${server.address().port}/src/index.html`
  const browser = await chromium.launch()

  async function open() {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => console.error('[page error]', e.message))
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text())
    })
    await page.goto(url)
    await page.waitForFunction(() => window.__ready === true || window.__bootError !== undefined, null, {
      timeout: 120_000,
    })
    const bootError = await page.evaluate(() => window.__bootError)
    if (bootError) throw new Error(`page failed to boot: ${bootError}`)
    const missing = await page.evaluate(() => window.__missingFonts ?? [])
    if (missing.length) throw new Error(`fonts not loaded: ${missing.join(', ')}`)
    return page
  }

  async function close() {
    await browser.close()
    server.close()
  }

  return { open, close }
}
