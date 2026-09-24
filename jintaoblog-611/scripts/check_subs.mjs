// Fail if any subtitle chunk is wider than the subtitle strip.
//
//   node jintaoblog-611/scripts/check_subs.mjs
//
// Puts every chunk from timeline.json into the page's real #subtitle span and
// measures the text. Fix an overflow by adding a "|" break to the line in
// content.json (not spoken, so the cached narration is reused) and re-running
// tts.py.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

const server = createServer(async (request, response) => {
  const file = join(
    ROOT,
    normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)),
  )
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
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch()
let overflow = 0
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
  })
  await page.goto(
    `http://127.0.0.1:${server.address().port}/jintaoblog-611/src/index.html`,
  )
  await page.waitForFunction(
    () => window.__ready === true || window.__bootError !== undefined,
  )
  const { box, rows } = await page.evaluate(async () => {
    const timeline = await (await fetch('../timeline.json')).json()
    const span = document.querySelector('#subtitle span')
    const style = getComputedStyle(span)
    const padding =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    const box =
      parseFloat(style.maxWidth) -
      (style.boxSizing === 'border-box' ? padding : 0)
    const range = document.createRange()
    const rows = []
    for (const scene of timeline.scenes)
      for (const line of scene.lines)
        for (const sub of line.subs) {
          span.textContent = sub.text
          range.selectNodeContents(span)
          rows.push({
            start: sub.start,
            text: sub.text,
            width: Math.ceil(range.getBoundingClientRect().width),
          })
        }
    return { box, rows }
  })
  const over = rows.filter((row) => row.width > box)
  overflow = over.length
  const widest = Math.max(...rows.map((row) => row.width))
  console.log(
    `subtitles: ${rows.length} chunks, widest ${widest}px of ${box}px, ${overflow} too wide`,
  )
  for (const row of over)
    console.log(`  ${row.start.toFixed(2)}s  ${row.width}px  ${row.text}`)
} finally {
  await browser.close()
  server.close()
}
process.exit(overflow ? 1 : 0)
