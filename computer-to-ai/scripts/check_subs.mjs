// Fails the build if any subtitle chunk is wider than the subtitle strip.
// Each era restyles the subtitles (handwriting, serif, mono…), so every chunk
// is measured in the typeface of the scene it belongs to.
//
//   node scripts/check_subs.mjs
//
// Fix an overflow by adding a "|" break to the line in content.json (it is not
// spoken, so cached narration is reused) and re-running tts.py.

import { launch } from './page.mjs'

const { open, close } = await launch()
let tooWide = []
try {
  const page = await open()
  const { limit, rows } = await page.evaluate(async () => {
    const timeline = await (await fetch('../timeline.json')).json()
    const stage = document.querySelector('#stage')
    const span = document.querySelector('#subtitle span')
    const range = document.createRange()
    const rows = []
    let limit = 0
    for (const scene of timeline.scenes) {
      stage.className = `era-${scene.id}`
      const css = getComputedStyle(span)
      limit = parseFloat(css.maxWidth) - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
      for (const line of scene.lines)
        for (const sub of line.subs) {
          span.textContent = sub.text
          range.selectNodeContents(span)
          rows.push({ t: sub.start, text: sub.text, width: Math.ceil(range.getBoundingClientRect().width), limit })
        }
    }
    return { limit, rows }
  })
  tooWide = rows.filter((r) => r.width > r.limit)
  console.log(`subtitles: ${rows.length} chunks, widest ${Math.max(...rows.map((r) => r.width))}px of ${limit}px, ${tooWide.length} too wide`)
  for (const r of tooWide) console.log(`  ${r.t.toFixed(2)}s  ${r.width}px  ${r.text}`)
} finally {
  await close()
}
process.exit(tooWide.length ? 1 : 0)
