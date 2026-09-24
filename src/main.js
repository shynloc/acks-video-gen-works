// ACKS promo · 45 s · 1080 × 1920
//
// Every visual property is a pure function of t (seconds). Nothing animates on
// its own, so scripts/render.mjs can capture frames in any order and in parallel.
// Music runs at 96 BPM: one bar = 2.5 s, 18 bars = 45 s. Scene cuts sit on bar lines.

const W = 1080
const H = 1920

// ---------- copy (all taken from the acks.com.cn page defaults) ----------

const STATUS_EN = 'FUNCTION FIRST · HUMAN BY DESIGN'
const FRAME_LABEL = 'SYSTEM · 可用的系统'
const LABEL_TECH = '01 / 数字科技 · TECHNOLOGY'
const LABEL_AUTO = '02 / 汽车科技 · AUTOMOTIVE'
const LABEL_METHOD = '03 / 工作方法 · HOW WE WORK'

// technology.ts → capabilities.items (A / C / K / S)
const TECH = [
  {
    letter: 'A',
    word: 'AI Agent',
    zh: 'AI Agent 与 Harness',
    kw: '企业平台 · 专用 Agent · Harness',
  },
  {
    letter: 'C',
    word: 'Creative',
    zh: '创意与 Vibe Coding',
    kw: 'AI 图像与视频 · 品牌界面 · 内容生产',
  },
  {
    letter: 'K',
    word: 'Knowledge',
    zh: '知识系统',
    kw: '结构 · 检索 · 来源 · 更新',
  },
  {
    letter: 'S',
    word: 'Service',
    zh: '企业服务',
    kw: '企业网站与 CMS · GEO · 软件定制',
  },
]
// about.ts → identity.sides[1].terms
const AUTO = ['Automotive', 'Custom', 'Kinetic', 'Sport']
// automotive.ts → disciplines.items
const AUTO_DIRECTIONS = [
  '原厂升级',
  '外观套件',
  '改色贴膜',
  '底盘强化',
  '性能进阶',
  '内饰定制',
]
// technology.ts → visual.body: “上下文、工具、权限、运行记录，以及人在关键节点的判断”
const NODES = [
  { angle: -120, text: '模型' },
  { angle: -60, text: '上下文' },
  { angle: 0, text: '工具' },
  { angle: 60, text: '权限' },
  { angle: 120, text: '运行记录' },
  { angle: 180, text: '人的判断', key: true },
]
// technology.ts → method.steps
const STEPS = [
  {
    index: '01',
    title: '理解问题',
    desc: '厘清使用者、现有流程与真正需要改变的结果',
  },
  {
    index: '02',
    title: '组织方案',
    desc: '用结构、原型和小范围验证，把设想变成可讨论的系统',
  },
  {
    index: '03',
    title: '构建验证',
    desc: '在明确权限、来源与人工控制下实现、测试并交付',
  },
  {
    index: '04',
    title: '持续改进',
    desc: '根据真实使用持续维护，而不是一次性交付后失联',
  },
]

// ---------- timing (seconds) ----------

const NODE_T = NODES.map((_, i) => 6.2 + i * 0.3125) // half-beats
const LETTER_T = TECH.map((_, i) => 16.875 + i * 1.875) // every three beats, on the beat
const SCRAMBLE_T = AUTO.map((_, i) => 25.15 + i * 0.12)
const CHIP_T = AUTO_DIRECTIONS.map((_, i) => 28.55 + i * 0.14)
const STEP_T = STEPS.map((_, i) => 33.45 + i * 0.625) // on the beat
const SWEEP = { start: 24.5, dur: 0.72 }
const TAN = 1 / Math.tan((62 * Math.PI) / 180) // "/" diagonal: x shift per px of height

// ---------- math ----------

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
const lerp = (a, b, p) => a + (b - a) * p
const prog = (t, start, dur) => clamp((t - start) / dur)

function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (s) => ((ax * s + bx) * s + cx) * s
  const sampleY = (s) => ((ay * s + by) * s + cy) * s
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let s = x
    for (let i = 0; i < 40; i++) {
      const v = sampleX(s)
      if (Math.abs(v - x) < 1e-7) break
      if (v < x) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return sampleY(s)
  }
}

const ease = {
  brand: cubicBezier(0.16, 1, 0.3, 1), // ACKS UI entry curve (UI-DESIGN-SYSTEM §10)
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  out: cubicBezier(0.22, 1, 0.36, 1),
  in: cubicBezier(0.64, 0, 0.78, 0),
  dock: cubicBezier(0.76, 0, 0.2, 1),
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  back: (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const c1 = 1.5
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
  },
}

function hash(n) {
  let x = n | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const RGB = {
  ink: [17, 19, 21, 1],
  inkIdle: [17, 19, 21, 0.1],
  white: [245, 245, 242, 1],
  whiteIdle: [245, 245, 242, 0.1],
  orange: [240, 120, 40, 1],
  red: [213, 40, 50, 1],
}

const mix = (a, b, p) => {
  const c = a.map((v, i) => lerp(v, b[i], p))
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${c[3].toFixed(3)})`
}

// ---------- DOM helpers ----------

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const px = (v) => `${v.toFixed(2)}px`

// 'inherit' rather than 'visible' so a hidden parent still hides its children.
function vis(el, on) {
  el.style.visibility = on ? 'inherit' : 'hidden'
  return on
}

function maskLines(inners, t, starts, outs = [], dur = 0.85) {
  inners.forEach((inner, i) => {
    let y = 118 * (1 - ease.brand(prog(t, starts[i], dur)))
    if (outs[i] !== undefined) y -= 118 * ease.inOut(prog(t, outs[i], 0.45))
    inner.style.transform = `translate3d(0, ${y.toFixed(3)}%, 0)`
  })
}

function rise(
  el,
  t,
  start,
  { dur = 0.75, dist = 26, out = null, outDur = 0.4, outDist = -18 } = {},
) {
  const p = ease.brand(prog(t, start, dur))
  let opacity = prog(t, start, dur * 0.45)
  let y = (1 - p) * dist
  if (out !== null) {
    const q = ease.inOut(prog(t, out, outDur))
    opacity *= 1 - q
    y += q * outDist
  }
  el.style.opacity = opacity.toFixed(3)
  el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`
}

function typeText(el, text, t, start, cps = 30) {
  if (t < start) {
    el.textContent = ''
    el.classList.remove('typing')
    return
  }
  const n = Math.min(text.length, Math.floor((t - start) * cps) + 1)
  el.textContent = text.slice(0, n)
  el.classList.toggle('typing', n < text.length)
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function scramble(el, from, to, t, start, dur, seed) {
  const p = prog(t, start, dur)
  if (p <= 0) {
    el.textContent = from
    return
  }
  if (p >= 1) {
    el.textContent = to
    return
  }
  const length = Math.round(lerp(from.length, to.length, clamp(p * 2)))
  const tick = Math.floor(t * 15)
  let text = ''
  for (let i = 0; i < length; i++) {
    const settle = 0.3 + 0.62 * (i / Math.max(1, to.length - 1))
    const target = to[i] ?? ' '
    if (p >= settle) text += target
    else if (target === ' ') text += ' '
    else
      text +=
        GLYPHS[
          Math.floor(hash(tick * 977 + i * 131 + seed * 7919) * GLYPHS.length)
        ]
  }
  el.textContent = text
}

function draw(path, t, start, dur, e = ease.inOut) {
  if (path.__length === undefined) path.__length = path.getTotalLength()
  const length = path.__length
  const p = e(prog(t, start, dur))
  path.style.strokeDasharray = `${length.toFixed(2)} ${(length + 2).toFixed(2)}`
  path.style.strokeDashoffset = (length * (1 - p)).toFixed(2)
  path.style.visibility = p > 0 ? 'inherit' : 'hidden'
}

// Region left of a "/" edge that crosses the bottom (y = h) at x = s.
function sweepPoly(s, h = H) {
  return `polygon(-40px -20px, ${px(s + (h + 20) * TAN)} -20px, ${px(s - 20 * TAN)} ${h + 20}px, -40px ${h + 20}px)`
}

// Band between two parallel "/" edges a < b.
function bandPoly(a, b, h = H) {
  const top = (h + 20) * TAN
  const bottom = -20 * TAN
  return `polygon(${px(a + top)} -20px, ${px(b + top)} -20px, ${px(b + bottom)} ${h + 20}px, ${px(a + bottom)} ${h + 20}px)`
}

function squarePoly(cx, cy, side) {
  const h = side / 2
  return `polygon(${px(cx - h)} ${px(cy - h)}, ${px(cx + h)} ${px(cy - h)}, ${px(cx + h)} ${px(cy + h)}, ${px(cx - h)} ${px(cy + h)})`
}

// The window shows a square region of the 1915 × 821 original centred on
// (xc, yc) in source pixels, zoomed by z. Prepared JPEGs are 1300 px tall.
function placeImage(img, xc, z, yc = 410.5) {
  const k = (1080 * z) / 1300
  const f = 1300 / 821
  img.style.transform = `translate(${px(540 - xc * f * k)}, ${px(540 - yc * f * k)}) scale(${k.toFixed(5)})`
}

// ---------- build ----------

const SYMBOL_PATHS = [
  'M421.06 225.16V0L0 377.2h262c11.84-75.87 76.17-136.67 159.06-152.04Z',
  'M671.945 0A221.055 221.055 0 0 0 450.89 221.055V403.52h221.055V221.055H893A221.055 221.055 0 0 0 671.945 0Z',
  'M0 403.52h450.89v221.055H225l225.89 221.055H315.66l-89.34-95.74v95.74H0Z',
  'M671.945 403.52A221.055 221.055 0 1 1 450.89 624.575h221.055Z',
]

const SYMBOL = `<svg viewBox="0 0 893 845.63" aria-hidden="true"><g fill="currentColor">${SYMBOL_PATHS.map(
  (d) => `<path d="${d}"/>`,
).join('')}</g></svg>`

function buildChrome() {
  for (const scene of $$('[data-chrome]')) {
    scene.insertAdjacentHTML(
      'beforeend',
      `<div class="chrome"><div class="brand">${SYMBOL}<b>ACKS</b></div><div class="url mono">acks.com.cn</div></div>`,
    )
  }
}

const ROW_TOP = 620
const ROW_H = 212

function buildIndex(scene) {
  const auto = scene.dataset.variant === 'auto'
  const rows = TECH.map(
    (row, i) => `
      <div class="row" style="top:${ROW_TOP + i * ROW_H}px">
        <i class="hair"></i>
        <div class="letter">${row.letter}</div>
        <div class="word"><span class="w">${row.word}</span><i class="bar"></i></div>
        <div class="zh">${row.zh}</div>
        <div class="kw">${row.kw}</div>
      </div>`,
  ).join('')
  scene.insertAdjacentHTML(
    'afterbegin',
    `<div class="bg"></div>
     <div class="label idx-label"><i class="sq"></i><span class="txt"></span></div>
     <h2 class="head idx-head idx-head1">
       <div class="line"><span class="in"><span class="en">ACKS</span>，是名称，</span></div>
       <div class="line"><span class="in">也是能力索引。</span></div>
     </h2>
     ${
       auto
         ? `<h2 class="head idx-head idx-head2">
              <div class="line"><span class="in">一个品牌，</span></div>
              <div class="line"><span class="in">两种工作语境。</span></div>
            </h2>
            <div class="idx-sub">方案咨询 · 零配件与升级产品 · 项目协作</div>`
         : ''
     }
     <div class="rows">${rows}</div>`,
  )
}

const DIAGRAM = {
  cx: 540,
  cy: 1110,
  r: 300,
  arc: 362,
  frame: { x: 150, y: 720, side: 780 },
}

function buildDiagram() {
  const { cx, cy, r, arc, frame } = DIAGRAM
  const points = NODES.map(({ angle }) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  }))
  let svg = `<path class="arc" d="M ${cx} ${cy - arc} A ${arc} ${arc} 0 1 1 ${cx - 0.01} ${cy - arc}"/>`
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    svg += `<path class="hex" d="M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${q.x.toFixed(1)} ${q.y.toFixed(1)}"/>`
  })
  points.forEach((p) => {
    svg += `<path class="spoke" d="M ${cx} ${cy} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}"/>`
  })
  const { x, y, side } = frame
  svg += `<path class="frame" d="M ${x} ${y} H ${x + side} V ${y + side} H ${x} Z"/>`
  const c = 46
  svg += `<path class="corner" d="M ${x} ${y + c} V ${y} H ${x + c}"/>`
  svg += `<path class="corner" d="M ${x + side - c} ${y} H ${x + side} V ${y + c}"/>`
  svg += `<path class="corner" d="M ${x + side} ${y + side - c} V ${y + side} H ${x + side - c}"/>`
  svg += `<path class="corner" d="M ${x + c} ${y + side} H ${x} V ${y + side - c}"/>`
  $('#s2-svg').innerHTML = svg
  $('#s2-chips').innerHTML = NODES.map(
    (node, i) =>
      `<div class="chip${node.key ? ' key' : ''}" style="left:${points[i].x.toFixed(1)}px;top:${points[i].y.toFixed(1)}px">${
        node.key ? '<i class="dot"></i>' : ''
      }${node.text}</div>`,
  ).join('')
}

function buildSteps() {
  $('#s6-steps').innerHTML = STEPS.map(
    (step, i) => `
      <div class="step" style="top:${690 + i * 200}px">
        <i class="node"></i>
        <div class="idx">${step.index}</div>
        <div class="title">${step.title}</div>
        <div class="desc">${step.desc}</div>
      </div>`,
  ).join('')
}

function buildAutoChips() {
  $('#s5-chips').innerHTML = AUTO_DIRECTIONS.map(
    (text) => `<div class="chip-auto">${text}</div>`,
  ).join('')
}

// ---------- measure ----------

const M = {}

function measure() {
  const stage = $('#stage').getBoundingClientRect()
  const rel = (el) => {
    const r = el.getBoundingClientRect()
    return {
      x: r.left - stage.left,
      y: r.top - stage.top,
      w: r.width,
      h: r.height,
    }
  }

  const inline = rel($('#s1-ai'))
  const bigEl = $('#s1-bigai')
  bigEl.style.transform = 'none'
  const big = rel(bigEl)
  M.ai = { x: inline.x, y: inline.y, s: inline.w / big.w, w: big.w, h: big.h }

  const lockup = $('#s7-lockup')
  const box = lockup.getBBox()
  lockup.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
  const width = 720
  const height = (width * box.height) / box.width
  const left = (W - width) / 2
  const top = 648
  Object.assign(lockup.style, {
    width: px(width),
    height: px(height),
    left: px(left),
    top: px(top),
  })
  const counter = rel($('#s7-counter-ref'))
  M.counter = {
    cx: counter.x + counter.w / 2,
    cy: counter.y + counter.h / 2,
    side: counter.w,
  }
  M.lockup = { left, top }
}

// ---------- scenes ----------

function renderS1(t) {
  const scene = $('#s1')
  if (!vis(scene, t < 5.05)) return

  const drift = -16 * ease.sine(prog(t, 1.4, 3.6))
  $('#s1-body').style.transform = `translate3d(0, ${drift.toFixed(2)}px, 0)`

  // A full-frame “AI” is the first frame (and thumbnail), then docks into the headline.
  const landed = t >= 1.32
  const big = $('#s1-bigai')
  vis(big, !landed)
  $('#s1-ai').style.opacity = landed ? '1' : '0'
  if (!landed) {
    const s0 = lerp(1.05, 1, ease.out(prog(t, 0, 0.6)))
    const x0 = 540 - (M.ai.w * s0) / 2
    const y0 = 930 - (M.ai.h * s0) / 2
    const p = ease.dock(prog(t, 0.36, 0.94))
    const s = lerp(s0, M.ai.s, p)
    big.style.transform = `translate(${px(lerp(x0, M.ai.x, p))}, ${px(lerp(y0, M.ai.y, p))}) scale(${s.toFixed(5)})`
  }

  $('#s1-jy').style.transform =
    `translate3d(0, ${(118 * (1 - ease.brand(prog(t, 0.78, 0.85)))).toFixed(3)}%, 0)`
  $('#s1-comma').style.transform =
    `translate3d(0, ${(118 * (1 - ease.brand(prog(t, 1.02, 0.85)))).toFixed(3)}%, 0)`
  maskLines([$('#s1-l2 .in'), $('#s1-l3 .in')], t, [0.98, 1.12])

  rise($('#s1-kicker'), t, 1.45, { dist: 20 })
  $('#s1-rule').style.transform =
    `scaleX(${ease.brand(prog(t, 1.65, 1.0)).toFixed(4)})`
  rise($('#s1-status-zh'), t, 2.0, { dist: 18 })
  typeText($('#s1-status-en'), STATUS_EN, t, 2.35, 30)
}

function squareSide(t) {
  return lerp(96, 2100, ease.inOut(prog(t, 4.3, 0.7)))
}

function renderSquare(t) {
  const outline = $('#sq-outline')
  if (!vis(outline, t >= 3.95 && t < 5.0)) return
  const side =
    t < 4.3 ? lerp(0, 96, ease.brand(prog(t, 3.95, 0.35))) : squareSide(t)
  Object.assign(outline.style, {
    left: px(540 - side / 2),
    top: px(930 - side / 2),
    width: px(side),
    height: px(side),
    opacity: (1 - ease.inOut(prog(t, 4.5, 0.35))).toFixed(3),
  })
}

function renderS2(t) {
  const scene = $('#s2')
  if (!vis(scene, t >= 4.3 && t < 10.3)) return
  scene.style.clipPath = t < 5.0 ? squarePoly(540, 930, squareSide(t)) : 'none'

  maskLines($$('#s2-head .in'), t, [4.85, 5.0], [9.2, 9.26])

  const core = $('#s2-core .pill')
  core.style.opacity = prog(t, 5.45, 0.12).toFixed(3)
  core.style.transform = `translate(-50%, -50%) scale(${lerp(0.5, 1, ease.back(prog(t, 5.45, 0.5))).toFixed(4)})`
  $$('#s2-core .ring').forEach((ring, k) => {
    const start = 5.75 + k * 0.625
    if (t < start) {
      ring.style.opacity = '0'
      return
    }
    const phase = ((t - start) % 1.25) / 1.25
    ring.style.transform = `scale(${lerp(0.9, 3.1, ease.out(phase)).toFixed(4)})`
    ring.style.opacity = (0.6 * (1 - phase)).toFixed(3)
  })

  const spokes = $$('#s2-svg .spoke')
  const hexes = $$('#s2-svg .hex')
  NODE_T.forEach((start, i) => draw(spokes[i], t, start, 0.42, ease.out))
  hexes.forEach((hex, i) => draw(hex, t, 7.95 + i * 0.07, 0.55))
  draw($('#s2-svg .arc'), t, 6.45, 2.5)
  draw($('#s2-svg .frame'), t, 8.2, 0.85)
  $$('#s2-svg .corner').forEach((corner, i) =>
    draw(corner, t, 8.85 + i * 0.05, 0.35, ease.out),
  )
  typeText($('#s2-frame-label'), FRAME_LABEL, t, 8.8, 32)

  $$('#s2-chips .chip').forEach((chip, i) => {
    const p = prog(t, NODE_T[i] + 0.28, 0.45)
    chip.style.opacity = clamp(p * 3).toFixed(3)
    chip.style.transform = `translate(-50%, -50%) scale(${lerp(0.72, 1, ease.back(p)).toFixed(4)})`
  })

  const exit = ease.inOut(prog(t, 9.25, 0.6))
  const diagram = $('#s2-diagram')
  diagram.style.transform = `scale(${(1 + 0.12 * exit).toFixed(4)})`
  diagram.style.opacity = (1 - exit).toFixed(3)
}

function renderS3(t) {
  const scene = $('#s3')
  if (!vis(scene, t >= 9.3 && t < 15.05)) return
  $('#s3 > .bg').style.opacity = ease.inOut(prog(t, 9.4, 0.7)).toFixed(3)

  const win = $('#s3-win')
  const grow = ease.brand(prog(t, 9.35, 1.0))
  const shrink = ease.inOut(prog(t, 14.45, 0.55))
  win.style.transform = `scale(${(lerp(780 / 1080, 1, grow) * lerp(1, 0.965, shrink)).toFixed(5)})`
  win.style.opacity = prog(t, 9.35, 0.3).toFixed(3)
  const drift = ease.sine(prog(t, 9.35, 5.7))
  placeImage($('#s3-img'), lerp(1270, 1440, drift), lerp(1, 1.075, drift))

  maskLines($$('#s3-head .in'), t, [9.85, 9.97], [14.28, 14.34])
  rise($('#s3-tag'), t, 10.45, { dist: 14 })
  rise($('#s3-cap'), t, 10.95, { dist: 18 })
}

function renderIndex(scene, t, auto) {
  const label = $('.idx-label .txt', scene)
  if (auto && t >= 25.1) typeText(label, LABEL_AUTO, t, 25.1, 34)
  else typeText(label, LABEL_TECH, t, 14.95, 30)
  $('.idx-label .sq', scene).style.transform =
    `scale(${ease.back(prog(t, 14.9, 0.4)).toFixed(4)})`

  maskLines(
    $$('.idx-head1 .in', scene),
    t,
    [15.0, 15.12],
    auto ? [25.0, 25.06] : [],
  )
  if (auto) {
    maskLines($$('.idx-head2 .in', scene), t, [25.28, 25.4], [27.22, 27.28])
    rise($('.idx-sub', scene), t, 25.85, { dist: 16, out: 27.2, outDur: 0.3 })
  }

  const rows = $('.rows', scene)
  if (!vis(rows, !auto || t < 28.2)) return

  $$('.row', scene).forEach((row, i) => {
    const letter = $('.letter', row)
    rise(letter, t, 15.25 + i * 0.09, { dist: 60, dur: 0.9 })
    $('.hair', row).style.transform =
      `scaleX(${ease.brand(prog(t, 15.35 + i * 0.09, 1.0)).toFixed(4)})`

    // Letter colour: idle → orange as its row lights up → ink when the next row takes over.
    const start = LETTER_T[i]
    const next = i < LETTER_T.length - 1 ? LETTER_T[i + 1] : 23.5
    const idle = auto ? RGB.whiteIdle : RGB.inkIdle
    const fg = auto ? RGB.white : RGB.ink
    let color
    if (t < start) color = mix(idle, idle, 0)
    else if (t < next)
      color = mix(idle, RGB.orange, ease.out(prog(t, start, 0.25)))
    else color = mix(RGB.orange, fg, ease.inOut(prog(t, next, 0.4)))
    if (auto && t >= 25.0) {
      const s = SCRAMBLE_T[i]
      color = mix(
        RGB.white,
        RGB.red,
        prog(t, s, 0.1) * (1 - ease.inOut(prog(t, s + 0.3, 0.5))),
      )
    }
    letter.style.color = color

    const pw = ease.brand(prog(t, start + 0.05, 0.6))
    const w = $('.w', row)
    w.style.clipPath = `polygon(-4% -40%, ${(pw * 108 - 4).toFixed(2)}% -40%, ${(pw * 108 - 4).toFixed(2)}% 140%, -4% 140%)`
    $('.word', row).style.transform =
      `translate3d(${((1 - pw) * 24).toFixed(2)}px, 0, 0)`
    $('.bar', row).style.transform =
      `scaleX(${ease.brand(prog(t, start + 0.15, 0.7)).toFixed(4)})`
    if (auto) scramble(w, TECH[i].word, AUTO[i], t, SCRAMBLE_T[i], 0.6, i + 1)

    const out = auto ? 25.02 : null
    rise($('.zh', row), t, start + 0.2, {
      dist: 18,
      out,
      outDur: 0.3,
      outDist: -10,
    })
    rise($('.kw', row), t, start + 0.35, {
      dist: 14,
      out,
      outDur: 0.3,
      outDist: -10,
    })
  })
}

function renderS4(t) {
  const scene = $('#s4')
  if (!vis(scene, t >= 14.45 && t < 25.3)) return
  const top = lerp(H, 0, ease.inOut(prog(t, 14.45, 0.55)))
  scene.style.clipPath = t < 15.0 ? `inset(${px(top)} 0 0 0)` : 'none'
  const edge = $('#s4-edge')
  if (vis(edge, t >= 14.45 && t < 15.0))
    edge.style.transform = `translate3d(0, ${px(top - 4)}, 0)`
  renderIndex(scene, t, false)
}

function sweepEdge(t) {
  return lerp(
    -H * TAN - 60,
    W + 280,
    ease.inOut(prog(t, SWEEP.start, SWEEP.dur)),
  )
}

function renderBands(t) {
  const on = t >= SWEEP.start && t < SWEEP.start + SWEEP.dur
  const red = $('#band-red')
  const silver = $('#band-silver')
  vis(red, on)
  vis(silver, on)
  if (!on) return
  const s = sweepEdge(t)
  red.style.clipPath = bandPoly(s - 130, s)
  silver.style.clipPath = bandPoly(s - 205, s - 165)
}

function renderS5(t) {
  const scene = $('#s5')
  if (!vis(scene, t >= SWEEP.start && t < 32.55)) return
  scene.style.clipPath =
    t < SWEEP.start + SWEEP.dur ? sweepPoly(sweepEdge(t) - 130) : 'none'
  renderIndex(scene, t, true)

  maskLines($$('#s5-head2 .in'), t, [27.6, 27.72])

  const win = $('#s5-win')
  if (!vis(win, t >= 27.3)) return
  const edge = lerp(-1080 * TAN - 40, W + 60, ease.inOut(prog(t, 27.3, 0.7)))
  win.style.clipPath = t < 28.0 ? sweepPoly(edge, 1080) : 'none'
  const band = $('#s5-win-edge')
  if (vis(band, t < 28.0)) band.style.clipPath = bandPoly(edge - 18, edge, 1080)
  const drift = ease.sine(prog(t, 27.3, 5.25))
  placeImage($('#s5-img'), lerp(1110, 1240, drift), lerp(1, 1.07, drift))
  rise($('#s5-tag'), t, 28.0, { dist: 14 })
  $$('#s5-chips .chip-auto').forEach((chip, i) =>
    rise(chip, t, CHIP_T[i], { dist: 16 }),
  )
}

function renderS6(t) {
  const scene = $('#s6')
  if (!vis(scene, t >= 32.0)) return
  const top = lerp(H, 0, ease.inOut(prog(t, 32.0, 0.5)))
  scene.style.clipPath = t < 32.5 ? `inset(${px(top)} 0 0 0)` : 'none'
  const edge = $('#s6-edge')
  if (vis(edge, t >= 32.0 && t < 32.5))
    edge.style.transform = `translate3d(0, ${px(top - 4)}, 0)`

  $('.chrome', scene).style.opacity = (
    1 - ease.inOut(prog(t, 39.6, 0.45))
  ).toFixed(3)

  const label = $('#s6-label')
  typeText($('.txt', label), LABEL_METHOD, t, 32.45, 32)
  $('.sq', label).style.transform =
    `scale(${ease.back(prog(t, 32.4, 0.4)).toFixed(4)})`
  label.style.opacity = (1 - ease.inOut(prog(t, 37.1, 0.35))).toFixed(3)
  maskLines($$('#s6-head .in'), t, [32.5, 32.62], [37.12, 37.18])

  const leave = ease.inOut(prog(t, 37.1, 0.5))
  const rail = $('#s6-rail')
  rail.style.opacity = (1 - leave).toFixed(3)
  $('.track', rail).style.transform =
    `scaleY(${ease.brand(prog(t, 32.7, 0.9)).toFixed(4)})`
  $('.fill', rail).style.transform =
    `scaleY(${prog(t, STEP_T[0], STEP_T[3] - STEP_T[0]).toFixed(4)})`

  $$('#s6-steps .step').forEach((step, i) => {
    const start = STEP_T[i]
    const node = $('.node', step)
    node.style.opacity = prog(t, 32.8 + i * 0.08, 0.3).toFixed(3)
    node.style.setProperty('--fill', ease.back(prog(t, start, 0.35)).toFixed(4))
    rise($('.idx', step), t, start, { dist: 16 })
    rise($('.title', step), t, start + 0.05, { dist: 22 })
    rise($('.desc', step), t, start + 0.15, { dist: 14 })
    const away = ease.inOut(prog(t, 37.1 + i * 0.05, 0.45))
    step.style.opacity = (1 - away).toFixed(3)
    step.style.transform = `translate3d(0, ${(-30 * away).toFixed(2)}px, 0)`
  })

  renderS7(t)
}

function renderS7(t) {
  const root = $('#s7')
  if (!vis(root, t >= 37.3)) return
  maskLines($$('#s7-cta .in'), t, [37.5, 37.62, 37.74], [39.62, 39.68, 39.74])

  // The logo’s central square lands first; the approved lockup then appears whole around it.
  const counter = $('#s7-counter')
  if (vis(counter, t >= 39.85 && t < 40.8)) {
    const side = lerp(300, M.counter.side, ease.brand(prog(t, 39.85, 0.65)))
    Object.assign(counter.style, {
      left: px(M.counter.cx - side / 2),
      top: px(M.counter.cy - side / 2),
      width: px(side),
      height: px(side),
      opacity: (1 - ease.inOut(prog(t, 40.45, 0.3))).toFixed(3),
    })
  }

  const lockup = $('#s7-lockup')
  lockup.style.opacity = prog(t, 40.2, 0.35).toFixed(3)
  lockup.style.transformOrigin = `${px(M.counter.cx - M.lockup.left)} ${px(M.counter.cy - M.lockup.top)}`
  lockup.style.transform = `scale(${lerp(0.94, 1, ease.brand(prog(t, 40.2, 0.9))).toFixed(5)})`
  $('#s7-word-rect').setAttribute(
    'width',
    lerp(0, 400, ease.brand(prog(t, 40.45, 0.8))).toFixed(2),
  )

  rise($('#s7-name'), t, 40.75, { dist: 18 })
  $('#s7-rule').style.transform =
    `scaleX(${ease.brand(prog(t, 40.9, 0.9)).toFixed(4)})`
  rise($('#s7-url'), t, 41.0, { dist: 20 })
  rise($('#s7-mail'), t, 41.12, { dist: 16 })
  rise($('#s7-index'), t, 41.3, { dist: 12 })
}

function render(t) {
  renderS1(t)
  renderSquare(t)
  renderS2(t)
  renderS3(t)
  renderS4(t)
  renderS5(t)
  renderBands(t)
  renderS6(t)
}

// ---------- sound cues (read by scripts/music.py via render.mjs --cues) ----------

const CUES = [
  { t: 0, kind: 'open' },
  { t: 0.42, kind: 'swish', dur: 0.9 },
  { t: 2.35, kind: 'type', dur: STATUS_EN.length / 30 },
  { t: 3.95, kind: 'blip' },
  { t: 4.3, kind: 'whoosh', dur: 0.7 },
  { t: 5.45, kind: 'pop' },
  ...NODE_T.map((t, i) => ({ t: t + 0.28, kind: 'node', index: i })),
  { t: 8.2, kind: 'draw', dur: 0.85 },
  { t: 8.8, kind: 'type', dur: FRAME_LABEL.length / 32 },
  { t: 9.35, kind: 'whoosh', dur: 0.9 },
  { t: 14.45, kind: 'wipe', dur: 0.55 },
  { t: 14.95, kind: 'type', dur: LABEL_TECH.length / 30 },
  ...LETTER_T.map((t, i) => ({ t, kind: 'letter', index: i })),
  { t: SWEEP.start, kind: 'sweep', dur: SWEEP.dur },
  { t: 25.1, kind: 'type', dur: LABEL_AUTO.length / 34 },
  ...SCRAMBLE_T.map((t) => ({ t, kind: 'scramble', dur: 0.6 })),
  { t: 27.3, kind: 'whoosh', dur: 0.7 },
  ...CHIP_T.map((t) => ({ t, kind: 'tick' })),
  { t: 32.0, kind: 'wipe', dur: 0.5 },
  { t: 32.45, kind: 'type', dur: LABEL_METHOD.length / 32 },
  ...STEP_T.map((t, i) => ({ t, kind: 'step', index: i })),
  { t: 39.85, kind: 'logo' },
]

// ---------- boot ----------

async function loadFonts() {
  const dynamic = [
    STATUS_EN,
    FRAME_LABEL,
    LABEL_TECH,
    LABEL_AUTO,
    LABEL_METHOD,
    ...AUTO,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ]
  const text = $('#stage').textContent + dynamic.join('')
  const specs = [
    '400 40px "Noto Sans SC"',
    '700 40px "Noto Sans SC"',
    '500 40px "Space Grotesk"',
    '700 40px "Space Grotesk"',
    '400 40px "DM Sans"',
    '700 40px "DM Sans"',
    '400 40px "JetBrains Mono"',
    '700 40px "JetBrains Mono"',
  ]
  await Promise.all(specs.map((spec) => document.fonts.load(spec, text)))
  await document.fonts.ready
  window.__missingFonts = specs.filter(
    (spec) => !document.fonts.check(spec, text),
  )
}

async function boot() {
  buildChrome()
  $$('.index-scene').forEach(buildIndex)
  buildDiagram()
  buildSteps()
  buildAutoChips()
  await loadFonts()
  await Promise.all([...document.images].map((img) => img.decode()))
  measure()
  render(0)
  window.renderFrame = render
  window.__cues = CUES
  window.__ready = true
}

boot()
