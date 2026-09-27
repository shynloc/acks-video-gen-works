// 开关的觉醒 · 1080 × 1920
//
// The narration is the clock: every scene and line time comes from timeline.json
// (written by scripts/tts.py). Visual cues are relative to what is being said,
// e.g. c.W(2, '开关') = the moment line 2 reaches “开关”.
//
// Each era re-renders the screen in the technology of its time. Scene changes
// are a scanline that “re-prints” the frame top to bottom in the new era, with
// the HUD (year odometer, render-engine badge, 1936–2026 rail) and subtitles
// restyling as the line passes.

import { $, CUE, Cues, clamp, ease, hash, lerp, prog } from './lib.js'
import { SCENES as PART1 } from './scenes-early.js'
import { SCENES as PART2 } from './scenes-late.js'

const SCENES = { ...PART1, ...PART2 }

// Render-engine badge and the year the odometer shows (a scene may override the
// year over time with def.year(lt, cues)).
const ERAS = {
  cold: { engine: '开关', year: null },
  turing: { engine: '铅笔 · 纸带', year: 1936 },
  eniac: { engine: '电子管', year: 1946 },
  chip: { engine: '晶体管', year: 1947 },
  moon: { engine: '磷光屏', year: 1969 },
  pc: { engine: '8-bit 像素', year: 1984 },
  web: { engine: '256 色窗口', year: 1991 },
  phone: { engine: '多点触控', year: 2007 },
  neural: { engine: '神经网络', year: 1956 },
  go: { engine: '策略网络', year: 2016 },
  llm: { engine: 'Transformer', year: 2017 },
  finale: { engine: '语言模型', year: 2026 },
}
const RAIL = [1936, 2026]
const WIPE = 0.55 // scanline re-render duration at a scene change

let TIMELINE
let SUBS = []
const built = []

// ---------- HUD ----------

const hud = {}

function buildHud() {
  hud.root = $('#hud')
  hud.year = $('#year')
  hud.cols = []
  for (let i = 0; i < 4; i++) {
    const col = document.createElement('div')
    col.className = 'col'
    col.innerHTML = '<b></b><b></b>'
    hud.year.appendChild(col)
    hud.cols.push(col)
  }
  hud.engine = $('#engine span')
  hud.rail = $('#rail')
  hud.fill = $('#rail em')
  const scenesWithYears = TIMELINE.scenes.filter((s) => ERAS[s.id].year)
  for (const s of scenesWithYears) {
    const tick = document.createElement('i')
    tick.style.left = `${railPos(ERAS[s.id].year) * 100}%`
    hud.rail.appendChild(tick)
  }
  hud.dot = document.createElement('u')
  hud.rail.appendChild(hud.dot)
}

const railPos = (year) => clamp((year - RAIL[0]) / (RAIL[1] - RAIL[0]))

// Odometer: each digit column rolls only while every lower digit rolls over.
function renderYear(value) {
  if (typeof value === 'string') {
    // The future: static characters, no rolling.
    hud.cols.forEach((col, i) => {
      const [a, b] = col.children
      a.textContent = value[i] ?? ''
      b.textContent = ''
      a.style.transform = ''
    })
    return
  }
  const v = Math.max(0, value)
  let carry = v - Math.floor(v)
  for (let i = 0; i < 4; i++) {
    const place = 10 ** i
    const whole = Math.floor(v / place)
    const digit = whole % 10
    const col = hud.cols[3 - i]
    const [a, b] = col.children
    const off = carry
    a.textContent = String(digit)
    b.textContent = String((digit + 1) % 10)
    a.style.transform = `translateY(${(-off * 96).toFixed(1)}px)`
    b.style.transform = `translateY(${((1 - off) * 96).toFixed(1)}px)`
    // A higher column moves only while this one is passing 9 → 0.
    carry = digit === 9 ? carry : 0
  }
}

// The year shown at time t: eases from the previous scene's last year into this
// scene's, then follows the scene's own year() if it has one.
function yearAt(b, lt) {
  const own = b.def.year ? b.def.year(lt, b.cues) : ERAS[b.scene.id].year
  const prev = b.prevYear
  if (prev == null || own == null || typeof own === 'string') return own
  const p = ease.inOut(prog(lt, 0.05, 1.1))
  return lerp(prev, own, p)
}

let currentEra = ''

function renderChrome(t) {
  // Which scene owns the chrome: the incoming one once its scanline passes the HUD.
  let owner = built[0]
  for (const b of built) if (t >= b.scene.start + WIPE * 0.14) owner = b
  const lt = t - owner.scene.start
  const era = owner.scene.id
  if (era !== currentEra) {
    $('#stage').className = `era-${era}`
    currentEra = era
  }

  const year = yearAt(owner, lt)
  const hudOn = owner.def.hud ? owner.def.hud(lt, owner.cues) : year != null
  hud.root.style.opacity = typeof hudOn === 'number' ? hudOn.toFixed(3) : hudOn ? '1' : '0'
  if (year != null) {
    renderYear(year)
    const pos = railPos(typeof year === 'string' ? RAIL[1] : year)
    hud.dot.style.left = `${(pos * 100).toFixed(3)}%`
    hud.fill.style.transform = `scaleX(${pos.toFixed(4)})`
  }
  const engine = owner.def.engine ? owner.def.engine(lt, owner.cues) : ERAS[era].engine
  if (hud.engine.textContent !== engine) hud.engine.textContent = engine

  // Subtitles: hold the last chunk through short pauses, clear on scene breaks.
  let sub = null
  for (const s of SUBS) {
    if (s.start <= t) sub = s
    else break
  }
  const text = sub && t - sub.end < 0.45 ? sub.text : ''
  const span = $('#subtitle span')
  if (span.textContent !== text) span.textContent = text
  span.style.opacity = sub ? prog(t, sub.start, 0.06).toFixed(3) : '0'
}

// ---------- scene-change scanline ----------

const fx = $('#fx').getContext('2d')

function renderWipe(t) {
  fx.clearRect(0, 0, 1080, 1920)
  for (let i = 1; i < built.length; i++) {
    const b = built[i]
    const p = prog(t, b.scene.start, WIPE)
    if (p <= 0 || p >= 1) continue
    const y = ease.inOut(p) * 1920
    const color = b.def.wipe ?? '#ffffff'
    // Glitch slices trailing the line: the old frame tearing as it is overwritten.
    const frame = Math.floor(t * 30)
    for (let k = 0; k < 9; k++) {
      const h = 4 + hash(i, k, frame) * 26
      const yy = y - 20 - hash(k, i, 7, frame) * 260
      const x = hash(k, frame, 3) * 700
      const w = 120 + hash(frame, k, 11) * 500
      fx.globalAlpha = 0.25 + 0.5 * hash(k, frame)
      fx.fillStyle = k % 3 === 0 ? color : k % 3 === 1 ? '#ff2d55' : '#00e5ff'
      fx.fillRect(x, yy, w, h)
    }
    fx.globalAlpha = 1
    const glow = fx.createLinearGradient(0, y - 90, 0, y + 6)
    glow.addColorStop(0, 'rgba(255,255,255,0)')
    glow.addColorStop(1, color)
    fx.globalAlpha = 0.55
    fx.fillStyle = glow
    fx.fillRect(0, y - 90, 1080, 96)
    fx.globalAlpha = 1
    fx.fillStyle = '#fff'
    fx.fillRect(0, y - 3, 1080, 6)
  }
}

// ---------- frame ----------

function render(t) {
  for (let i = 0; i < built.length; i++) {
    const b = built[i]
    const { scene, root, state, cues, def } = b
    const lt = t - scene.start
    const next = built[i + 1]
    // A scene stays on screen under the next one until its scanline has passed.
    const endT = next ? next.scene.start + WIPE : scene.end + 0.02
    const on = t >= scene.start - 0.001 && t < endT
    root.style.visibility = on ? 'visible' : 'hidden'
    if (!on) continue
    def.render(state, lt, cues)
    const p = i === 0 ? 1 : prog(t, scene.start, WIPE)
    const cut = (1 - ease.inOut(p)) * 100
    root.style.clipPath = p < 1 ? `inset(0 0 ${cut.toFixed(3)}% 0)` : ''
  }
  renderWipe(t)
  renderChrome(t)
}

function collectCues() {
  CUE.log = []
  for (const b of built) {
    CUE.base = b.scene.start
    b.def.render(b.state, 0, b.cues)
    CUE.log.push({ kind: 'scene', t: b.scene.start, id: b.scene.id })
  }
  const seen = new Set()
  const cues = CUE.log
    .filter((c) => {
      const key = `${c.kind}@${c.t.toFixed(3)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.t - b.t)
  CUE.log = null
  return cues
}

// ---------- boot ----------

async function loadFonts() {
  const text =
    $('#stage').textContent +
    SUBS.map((s) => s.text).join('') +
    Object.values(ERAS)
      .map((e) => e.engine)
      .join('') +
    '渲染 · 0123456789,.%→▌_'
  const specs = [
    '400 40px Inter',
    '600 40px Inter',
    '800 40px Inter',
    '300 40px "Noto Sans SC"',
    '400 40px "Noto Sans SC"',
    '700 40px "Noto Sans SC"',
    '900 40px "Noto Sans SC"',
    '400 40px "Noto Serif SC"',
    '700 40px "Noto Serif SC"',
    '900 40px "Noto Serif SC"',
    '500 40px "LXGW WenKai"',
    '700 40px "LXGW WenKai"',
    '400 40px "Courier Prime"',
    '700 40px "Courier Prime"',
    '400 40px "JetBrains Mono"',
    '700 40px "JetBrains Mono"',
    '400 40px "Space Grotesk"',
    '700 40px "Space Grotesk"',
    '400 40px "Fira Code"',
    '700 40px "Fira Code"',
  ]
  await Promise.all(specs.map((spec) => document.fonts.load(spec, text)))
  await document.fonts.ready
  window.__missingFonts = specs.filter((spec) => !document.fonts.check(spec, text))
}

async function boot() {
  TIMELINE = await (await fetch('../timeline.json')).json()
  SUBS = TIMELINE.scenes.flatMap((s) => s.lines.flatMap((l) => l.subs))
  // Fonts first: some scenes rasterise text into canvases while building.
  await loadFonts()
  const host = $('#scenes')
  let prevYear = null
  for (const scene of TIMELINE.scenes) {
    const def = SCENES[scene.id]
    if (!def) throw new Error(`no visuals for scene ${scene.id}`)
    const root = document.createElement('section')
    root.className = 'scene'
    root.dataset.id = scene.id
    host.appendChild(root)
    const cues = new Cues(scene)
    const b = { scene, root, def, cues, state: def.build(root, cues), prevYear }
    built.push(b)
    const lastYear = def.year ? def.year(cues.D, cues) : ERAS[scene.id].year
    if (lastYear != null) prevYear = lastYear
  }
  buildHud()
  await loadFonts()
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})))
  window.__duration = TIMELINE.duration
  window.__cues = collectCues()
  window.renderFrame = render
  render(0)
  window.__ready = true
}

boot().catch((error) => {
  console.error(error)
  window.__bootError = String(error?.stack ?? error)
})
