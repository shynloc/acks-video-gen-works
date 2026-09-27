// Frame renderer. Every frame is a pure function of t, so workers render in parallel.
//
//   node scripts/render.mjs                         all frames → frames/00000.png …
//   node scripts/render.mjs --from 0 --to 1800      a range of frames
//   node scripts/render.mjs --stills 12.5,60        single frames → output/preview/
//   node scripts/render.mjs --cues                  sound cues → .cache/cues.json

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT, launch } from './page.mjs'

const FPS = 30
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

async function shoot(page, cdp, t, file) {
  await page.evaluate((time) => window.renderFrame(time), t)
  // Lossless PNG with fast compression; frames are deleted after encoding anyway.
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
  await writeFile(file, Buffer.from(data, 'base64'))
}

const { open, close } = await launch()
try {
  if (argv.includes('--cues')) {
    const page = await open()
    const cues = await page.evaluate(() => window.__cues)
    await mkdir(join(PROJECT, '.cache'), { recursive: true })
    const file = join(PROJECT, '.cache', 'cues.json')
    await writeFile(file, `${JSON.stringify(cues, null, 1)}\n`)
    console.log(`${file} (${cues.length} cues)`)
  } else if (arg('stills', null)) {
    const dir = join(PROJECT, 'output', 'preview')
    await mkdir(dir, { recursive: true })
    const page = await open()
    const cdp = await page.context().newCDPSession(page)
    for (const value of arg('stills').split(',')) {
      const t = Number(value)
      const file = join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`)
      await shoot(page, cdp, t, file)
      console.log(file)
    }
  } else {
    const probe = await open()
    const total = Math.round((await probe.evaluate(() => window.__duration)) * FPS)
    await probe.close()
    const from = Number(arg('from', 0))
    const to = Math.min(total, Number(arg('to', total)))
    const workers = Number(arg('workers', 4))
    const dir = join(PROJECT, 'frames')
    await mkdir(dir, { recursive: true })
    let next = from
    let done = 0
    const started = Date.now()
    await Promise.all(
      Array.from({ length: workers }, async () => {
        const page = await open()
        const cdp = await page.context().newCDPSession(page)
        while (next < to) {
          const frame = next++
          await shoot(page, cdp, frame / FPS, join(dir, `${String(frame).padStart(5, '0')}.png`))
          if (++done % 300 === 0) console.log(`${done}/${to - from} frames · ${(done / ((Date.now() - started) / 1000)).toFixed(1)} fps`)
        }
      }),
    )
    console.log(`rendered frames ${from}–${to - 1} in ${((Date.now() - started) / 1000).toFixed(0)} s`)
  }
} finally {
  await close()
}
