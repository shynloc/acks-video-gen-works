// 别再做 AI Slop 了 · jintaoblog 611 · 1080 × 1920
//
// The narration is the clock: every scene and line time comes from timeline.json
// (written by scripts/tts.py). Visual cues are expressed relative to what is being
// said, e.g. c.W(2, '能动性') = the moment line 2 reaches “能动性”.
// Every visual property is a pure function of t, so frames render in any order.

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
  const sx = (s) => ((ax * s + bx) * s + cx) * s
  const sy = (s) => ((ay * s + by) * s + cy) * s
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let s = x
    for (let i = 0; i < 40; i++) {
      const v = sx(s)
      if (Math.abs(v - x) < 1e-7) break
      if (v < x) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return sy(s)
  }
}

const ease = {
  theme: cubicBezier(0.25, 0.46, 0.45, 0.94), // Scrapboard --transition
  out: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.55, 0, 0.9, 0.3),
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  back: (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const c1 = 1.6
    const c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
  },
}

// ---------- colour (for the specimens) ----------

const hexToRgb = (h) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const unlin = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055

function rgbToLab([r0, g0, b0]) {
  const [r, g, b] = [lin(r0), lin(g0), lin(b0)]
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const X = inv(fy + a / 500) * 0.95047
  const Y = inv(fy)
  const Z = inv(fy - b / 200) * 1.08883
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ].map(unlin)
}

const css = (rgb) =>
  `rgb(${rgb.map((c) => Math.round(clamp(c) * 255)).join(', ')})`

// M3-style tone: keep hue and chroma of the key colour, set L* to the tone, gamut-map by chroma.
function tone(hex, T) {
  const [, a, b] = rgbToLab(hexToRgb(hex))
  let k = 1
  for (let i = 0; i < 40; i++) {
    const rgb = labToRgb([T, a * k, b * k])
    if (rgb.every((c) => c >= -0.002 && c <= 1.002)) return css(rgb)
    k *= 0.9
  }
  return css(labToRgb([T, 0, 0]))
}

// ---------- DOM ----------

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const LENGTH_KEYS = new Set([
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'fontSize',
])

function put(parent, cls, html = '', box = {}, tag = 'div') {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (html) el.innerHTML = html
  el.style.position = 'absolute'
  for (const [key, value] of Object.entries(box)) {
    if (key === 'rot') {
      el.dataset.rot = value
      el.style.transform = `rotate(${value}deg)`
    } else
      el.style[key] =
        typeof value === 'number' && LENGTH_KEYS.has(key) ? `${value}px` : value
  }
  parent.appendChild(el)
  return el
}

const rot = (el) => +(el.dataset.rot || 0)

// Chromium cannot draw the OpenType-SVG colour emoji font, so emoji are Noto PNGs.
const emo = (ch, size = '1em', lift = '-0.14em') => {
  const code = [...ch]
    .map((c) => c.codePointAt(0).toString(16))
    .filter((h) => h !== 'fe0f')
    .join('-')
  return `<img src="../../node_modules/emoji-datasource-google/img/google/64/${code}.png" style="display:inline-block;width:${size};height:${size};vertical-align:${lift}">`
}

// ---------- motion ----------

// Paper pinned to the board: drops in, over-rotates slightly, settles.
function pin(el, lt, start, { dur = 0.6, drop = 50 } = {}) {
  const p = prog(lt, start, dur)
  if (p <= 0) {
    el.style.opacity = '0'
    return
  }
  const d = ease.out(p)
  el.style.opacity = clamp(p * 4).toFixed(3)
  el.style.transform = `translate3d(0, ${(-drop * (1 - d)).toFixed(2)}px, 0) rotate(${(rot(el) + 4 * (1 - ease.back(p))).toFixed(3)}deg) scale(${(1 + 0.04 * (1 - d)).toFixed(4)})`
}

function rise(el, lt, start, { dur = 0.6, dist = 24 } = {}) {
  const p = ease.out(prog(lt, start, dur))
  el.style.opacity = prog(lt, start, dur * 0.5).toFixed(3)
  el.style.transform = `translate3d(0, ${((1 - p) * dist).toFixed(2)}px, 0) rotate(${rot(el)}deg)`
}

// Sound cues are collected by running every scene's renderer once (see collectCues).
let CUE_LOG = null
let CUE_BASE = 0

// Rubber stamp: comes down fast from above the page, bounces once.
function slam(el, lt, start) {
  if (CUE_LOG) CUE_LOG.push({ kind: 'stamp', t: CUE_BASE + start })
  const p = prog(lt, start, 0.17)
  if (p <= 0) {
    el.style.opacity = '0'
    return
  }
  const q = prog(lt, start + 0.17, 0.4)
  const s =
    p < 1
      ? lerp(2.2, 1, ease.in(p))
      : 1 + 0.045 * Math.sin(q * Math.PI * 2) * (1 - q)
  el.style.opacity = clamp(p * 3).toFixed(3)
  el.style.transform = `rotate(${rot(el)}deg) scale(${s.toFixed(4)})`
}

function pop(el, lt, start, { dur = 0.45, from = 0.6 } = {}) {
  const p = prog(lt, start, dur)
  el.style.opacity = clamp(p * 3).toFixed(3)
  el.style.transform = `rotate(${rot(el)}deg) scale(${lerp(from, 1, ease.back(p)).toFixed(4)})`
}

function away(el, lt, start, { dur = 0.35, dy = -40 } = {}) {
  const q = ease.in(prog(lt, start, dur))
  if (q <= 0) return
  el.style.opacity = ((+el.style.opacity || 0) * (1 - q)).toFixed(3)
  el.style.transform = `translate3d(0, ${(dy * q).toFixed(2)}px, 0) ${el.style.transform}`
}

function typeText(el, text, lt, start, cps = 30) {
  if (lt < start) {
    el.textContent = ''
    el.classList.remove('typing')
    return
  }
  const n = Math.min(text.length, Math.floor((lt - start) * cps) + 1)
  el.textContent = text.slice(0, n)
  el.classList.toggle('typing', n < text.length)
}

function draw(path, lt, start, dur = 0.5) {
  if (path.__len === undefined) path.__len = path.getTotalLength()
  const p = ease.out(prog(lt, start, dur))
  path.style.strokeDasharray = `${path.__len} ${path.__len + 4}`
  path.style.strokeDashoffset = (path.__len * (1 - p)).toFixed(2)
  path.style.visibility = p > 0 ? 'inherit' : 'hidden'
}

function grow(el, lt, start, dur = 0.4, axis = 'X') {
  el.style.transform = `scale${axis}(${ease.out(prog(lt, start, dur)).toFixed(4)})`
}

function wipe(el, lt, start, dur = 0.5) {
  const p = ease.out(prog(lt, start, dur))
  el.style.clipPath = `inset(-20px ${((1 - p) * 100).toFixed(2)}% -20px -20px)`
}

// ---------- cues ----------

const isCjk = (ch) => /[　-〿㐀-鿿＀-￯]/.test(ch)
const weight = (ch) => (isCjk(ch) ? 1 : /[A-Za-z0-9]/.test(ch) ? 0.45 : 0.15)

class Cues {
  constructor(scene) {
    this.scene = scene
    this.start = scene.start
    this.D = scene.end - scene.start
  }
  L(k) {
    return this.scene.lines[k].start - this.start
  }
  E(k) {
    return this.scene.lines[k].end - this.start
  }
  // Moment within line k at which `phrase` starts being spoken (character-weighted).
  W(k, phrase) {
    const line = this.scene.lines[k]
    const index = line.text.indexOf(phrase)
    if (index < 0)
      throw new Error(`cue “${phrase}” not in ${this.scene.id}[${k}]`)
    let before = 0
    let total = 0
    for (let i = 0; i < line.text.length; i++) {
      total += weight(line.text[i])
      if (i < index) before += weight(line.text[i])
    }
    return line.start - this.start + (line.end - line.start) * (before / total)
  }
}

// ---------- content ----------

const SYSTEMS = {
  hig: {
    no: '01',
    name: 'Apple HIG',
    tags: ['Apple', 'iOS / macOS / watchOS / tvOS / visionOS', '非开源'],
    tagline: '唯一由平台方亲自撰写的设计规范',
    url: 'developer.apple.com/design/human-interface-guidelines',
    cue: [2, '八条'],
  },
  m3: {
    no: '02',
    name: 'Material Design 3',
    tags: ['Google', 'Android / Flutter / Web', '开源'],
    tagline: '首个将情感驱动 UX 作为核心叙事的主流设计系统',
    url: 'm3.material.io',
    cue: [2, '5 个关键色'],
  },
  fluent: {
    no: '03',
    name: 'Microsoft Fluent 2',
    tags: ['Microsoft', 'Web / iOS / Android / Windows', '部分开源'],
    tagline: '克制的半透明 · 亿级用户验证的生产力美学',
    url: 'fluent2.microsoft.design',
    cue: [2, '形状系统'],
  },
  spectrum: {
    no: '04',
    name: 'Adobe Spectrum',
    tags: ['Adobe', '桌面 / 移动', '开源'],
    tagline: '理性驱动 · 每个组件都由研究和测试驱动',
    url: 'spectrum.adobe.com',
    cue: [2, '11 级'],
  },
  atlassian: {
    no: '05',
    name: 'Atlassian Design',
    tags: ['Atlassian', 'Web', '部分开源'],
    tagline: '把协作的产品内核深度融入设计哲学',
    url: 'atlassian.design',
    cue: [2, 'Design Token'],
  },
  carbon: {
    no: '06',
    name: 'Carbon Design System',
    tags: ['IBM', 'Web（多框架）', '完全开源'],
    tagline: '碳元素构建复杂结构 · 真正开源的企业级设计系统',
    url: 'carbondesignsystem.com',
    cue: [2, '2x Grid'],
  },
  ibm: {
    no: '07',
    name: 'IBM Design Language',
    tags: ['IBM', '全媒介（数字 + 印刷 + 视频）', '品牌资源开放'],
    tagline: '设计是我们建立纽带的方式',
    url: 'ibm.com/design/language',
    cue: [2, '遮住'],
  },
  protocol: {
    no: '08',
    name: 'Mozilla Protocol',
    tags: ['Mozilla', 'Web（营销网站）', '完全开源'],
    tagline: '为网站而生 · 唯一专注营销网站的设计系统',
    url: 'protocol.mozilla.org',
    cue: [2, '原则'],
  },
  google: {
    no: '09',
    name: 'Google Design',
    tags: ['Google', '内容平台（无平台限制）', '内容开放'],
    tagline: '设计永无止境 · 不是组件库，而是设计文化杂志',
    url: 'design.google',
    cue: [2, '杂志'],
  },
}

const TABLE = [
  ['Apple HIG', '极简克制、平台原生', 'Apple 生态原生 App', '否'],
  [
    'Material Design 3',
    '情感张扬、色彩鲜艳',
    'Android / Flutter / 消费级 App',
    '是',
  ],
  [
    'Microsoft Fluent 2',
    '冷静专业、高效克制',
    '企业级生产力工具 / B2B SaaS',
    '部分',
  ],
  ['Adobe Spectrum', '理性精确、研究驱动', '创意工具 / 专业桌面应用', '是'],
  [
    'Atlassian Design',
    '协作导向、拥抱混乱',
    '协作工具 / 项目管理 / AI 生产力',
    '部分',
  ],
  ['Carbon', '中性灰主导、模块化', '企业级 B2B / 数据密集型应用', '是'],
  [
    'IBM Design Language',
    '哲学深度、品牌统一',
    '企业品牌体系 / 全媒介设计',
    '资源开放',
  ],
  [
    'Mozilla Protocol',
    '灵活有机、全球化',
    '营销网站 / 品牌官网 / 开源官网',
    '是',
  ],
  [
    'Google Design',
    '编辑叙事、思辨文化',
    '设计灵感 / 行业趋势 / 案例研究',
    '内容开放',
  ],
]

const PROMPT = [
  ['> ', '使用 Material Design 3 的设计规范创建一个登录页。要求：'],
  ['', '① 色彩使用 primary 色 #6750A4 及其 tonal palette，支持动态取色；'],
  [
    '',
    '② 字体使用 Roboto，类型尺度遵循 display/headline/title/body/label 五级；',
  ],
  ['', '③ 间距使用 8dp 基准网格；'],
  ['', '④ 按钮使用 Filled Button 样式，圆角 20dp；'],
  ['', '⑤ 支持浅色/深色模式切换。'],
]

// ---------- shared scene furniture ----------

function stepHeader(root, n, title) {
  const stamp = put(root, 'stamp', `STEP ${n}`, {
    left: 84,
    top: 276,
    fontSize: 40,
    rot: -5,
  })
  const head = put(root, 'h2', title, {
    left: 84,
    top: 362,
    width: 912,
    fontSize: 56,
  })
  return { stamp, head }
}

function renderStepHeader(h, lt) {
  slam(h.stamp, lt, 0.12)
  rise(h.head, lt, 0.3)
}

function inkPath(d, box, width = 6, color = 'var(--red)') {
  return `<svg class="ink" viewBox="0 0 ${box[0]} ${box[1]}" style="position:absolute;left:0;top:0;width:${box[0]}px;height:${box[1]}px;stroke:${color};stroke-width:${width}"><path d="${d}"/></svg>`
}

// ---------- scenes ----------

const SCENES = {
  hook: {
    build(root) {
      const s = {}
      s.state = put(
        root,
        'paper',
        `<div class="tape washi" style="position:absolute;left:40px;top:-20px;transform:rotate(-4deg)"></div>
         <div class="h1" style="font-size:96px;line-height:1.3">AI 能生成代码，<br>但生成不了<span style="position:relative;display:inline-block">品味<svg class="ink mk" viewBox="0 0 200 40" preserveAspectRatio="none" style="position:absolute;left:-8px;bottom:-12px;width:calc(100% + 16px);height:30px"><path d="M4 28 C 54 14, 118 10, 196 20"/></svg></span>。</div>`,
        {
          left: 84,
          top: 330,
          width: 912,
          padding: '56px 56px 60px',
          rot: -1.2,
        },
      )
      s.mark = $('.mk path', s.state)
      s.ask1 = put(
        root,
        'lead',
        '在你抱怨“做出来的东西怎么这么丑”之前，先问问自己：',
        {
          left: 84,
          top: 760,
          width: 912,
        },
      )
      s.ask2 = put(root, 'hand', '你给过 AI 一个<br>好的设计标准吗？', {
        left: 84,
        top: 930,
        width: 912,
        fontSize: 82,
        lineHeight: '1.3',
        fontWeight: '700',
      })
      s.post = put(
        root,
        'paper lift',
        `<div class="tape washi" style="position:absolute;left:54px;top:-20px;transform:rotate(-4deg)"></div>
         <div class="tape" style="position:absolute;right:40px;bottom:-18px;transform:rotate(5deg)"></div>
         <div style="display:flex;gap:14px"><span class="dymo" style="transform:rotate(-1.5deg)">AI开发</span><span class="dymo" style="transform:rotate(1deg)">VibeCoding</span></div>
         <div class="stamp dt" style="position:absolute;right:48px;top:52px;font-size:30px;transform:rotate(-7deg)">2026.09.02</div>
         <div class="h1" style="margin-top:64px;font-size:118px;line-height:1.1">别再做</div>
         <div style="position:relative;font-family:Inter,'Noto Sans SC';font-weight:800;font-size:156px;line-height:1.12;letter-spacing:-0.02em">AI Slop <span style="font-family:'Noto Sans SC';font-weight:700">了</span><svg class="ink ul" viewBox="0 0 560 40" preserveAspectRatio="none" style="position:absolute;left:0;bottom:-6px;width:560px;height:34px"><path d="M6 24 C 120 10, 300 30, 552 14"/></svg></div>
         <div style="margin-top:40px;font-size:42px;line-height:1.5;font-weight:700">9 个世界级设计系统，<br>是 Vibe Coder 的审美必修课</div>
         <div style="margin-top:44px;border-top:2px dashed rgba(26,26,26,.25)"></div>
         <div class="mono" style="margin-top:26px;font-size:28px;color:var(--ink-light)">ShyNloc · ~/jintaoblog/朝夕见闻志</div>`,
        { left: 84, top: 300, width: 912, padding: '64px 60px 60px', rot: 1.2 },
      )
      s.stampDate = $('.dt', s.post)
      s.underline = $('.ul path', s.post)
      return s
    },
    render(s, lt, c) {
      pin(s.state, lt, 0.12)
      draw(s.mark, lt, c.W(0, '品味') + 0.2, 0.5)
      rise(s.ask1, lt, c.L(1))
      rise(s.ask2, lt, c.L(2))
      const swap = c.L(3) - 0.35
      for (const el of [s.state, s.ask1, s.ask2]) away(el, lt, swap)
      pin(s.post, lt, c.L(3))
      slam(s.stampDate, lt, c.L(3) + 0.8)
      s.stampDate.style.transform = `${s.stampDate.style.transform}`
      draw(s.underline, lt, c.W(3, 'AI Slop') + 0.3, 0.6)
    },
  },

  slop: {
    build(root) {
      const s = {}
      s.page = put(
        root,
        'slop-page',
        `<div class="bar" style="position:absolute"><i style="position:absolute">ai-generated.example</i></div>
         <div class="grad" style="position:absolute"></div>
         <div class="hero" style="position:absolute;top:140px">
           <div style="font-weight:800;font-size:78px;line-height:1.08;letter-spacing:-0.02em">Build the Future<br>with AI ${emo('✨', '64px', '-6px')}</div>
           <div style="margin-top:22px;font-weight:500;font-size:30px;opacity:.88">Supercharge your workflow ${emo('🚀', '32px', '-6px')}</div>
           <div style="display:inline-block;margin-top:34px;padding:18px 44px;border-radius:999px;background:#fff;color:#6d28d9;font-weight:700;font-size:28px;box-shadow:0 12px 30px rgba(40,10,90,.35)">Get Started →</div>
         </div>`,
        { left: 112, top: 290, width: 856, height: 980, rot: -1 },
      )
      s.grad = $('.grad', s.page)
      s.hero = $('.hero', s.page)
      s.cards = [0, 1, 2].map((i) =>
        put(
          s.page,
          'slop-card',
          `<div class="emo" style="position:absolute">${emo(['🚀', '✨', '💡'][i], '52px', '-8px')}</div>
           <div class="ln" style="position:absolute;left:32px;top:150px;width:170px"></div>
           <div class="ln" style="position:absolute;left:32px;top:184px;width:130px"></div>
           <div class="ln" style="position:absolute;left:32px;top:218px;width:150px"></div>`,
          { left: 40 + i * 266, top: 610, width: 244, height: 300 },
        ),
      )
      s.emoji = s.cards.map((card) => $('.emo', card))
      const note = (text, box) =>
        put(root, 'paper note', text, {
          padding: '8px 18px 10px',
          fontSize: 36,
          ...box,
        })
      s.notes = [
        note('毫无意义的渐变', { left: 36, top: 380, rot: -4 }),
        note('圆角堆圆角', { left: 96, top: 1176, rot: -3 }),
        note('居中放大的标题', { left: 690, top: 262, rot: 3 }),
        note('emoji 当图标', { left: 100, top: 836, rot: -4 }),
        note('紫蓝配色', { left: 700, top: 1150, rot: 3 }),
      ]
      s.ghosts = [
        [-18, -12, -2.5],
        [16, 10, 1.4],
      ].map(([dx, dy, r]) => {
        const g = s.page.cloneNode(true)
        g.dataset.rot = -1 + r
        g.style.left = `${112 + dx}px`
        g.style.top = `${290 + dy}px`
        root.insertBefore(g, s.page)
        return g
      })
      s.face = put(root, 'dymo', 'AI 的“平均脸”', {
        left: 360,
        top: 1296,
        fontSize: 32,
        rot: -1.5,
      })
      s.stamp = put(root, 'stamp', 'AI SLOP', {
        left: 180,
        top: 640,
        fontSize: 150,
        borderWidth: '11px',
        padding: '8px 34px 10px',
        rot: -9,
      })
      s.caption = put(root, 'h2', '能用，但难看得千篇一律。', {
        left: 84,
        top: 1294,
        width: 912,
        fontSize: 54,
        textAlign: 'center',
      })
      return s
    },
    render(s, lt, c) {
      pin(s.page, lt, 0.1)
      s.grad.style.opacity = ease.out(prog(lt, c.W(1, '渐变'), 0.6)).toFixed(3)
      s.cards.forEach((card, i) =>
        pop(card, lt, c.W(1, '圆角') + i * 0.12, { from: 0.5 }),
      )
      pop(s.hero, lt, c.W(2, '居中'), { from: 0.4 })
      s.emoji.forEach((e, i) =>
        pop(e, lt, c.W(2, 'emoji') + i * 0.1, { from: 0.2 }),
      )
      const cues = [
        c.W(1, '渐变'),
        c.W(1, '圆角'),
        c.W(2, '居中'),
        c.W(2, 'emoji'),
        c.W(2, '紫蓝'),
      ]
      s.notes.forEach((n, i) =>
        pin(n, lt, cues[i] + 0.15, { drop: 26, dur: 0.45 }),
      )
      const hue =
        prog(lt, c.W(2, '紫蓝'), 0.6) *
        (1 - prog(lt, c.W(2, '紫蓝') + 0.9, 0.5))
      s.grad.style.filter =
        hue > 0 ? `saturate(${(1 + 0.6 * hue).toFixed(3)})` : ''
      const ghost = ease.out(prog(lt, c.L(3), 0.8))
      s.ghosts.forEach((g) => {
        g.style.opacity = (0.32 * ghost).toFixed(3)
        g.style.transform = `rotate(${rot(g)}deg)`
      })
      pop(s.face, lt, c.W(3, '平均脸'))
      away(s.face, lt, c.L(4) - 0.1, { dy: 10 })
      for (const n of s.notes) away(n, lt, c.L(3) + 0.2, { dy: -10 })
      slam(s.stamp, lt, c.W(4, 'AI Slop'))
      rise(s.caption, lt, c.W(4, '能用'))
    },
  },

  average: {
    build(root) {
      const s = {}
      s.q1 = put(root, 'h1', '问题出在哪？', {
        left: 84,
        top: 292,
        fontSize: 96,
      })
      s.q2 = put(root, 'lead', '不是 AI 不行。', {
        left: 84,
        top: 420,
        fontSize: 54,
      })
      s.bestLabel = put(root, 'dymo', '最好的设计', {
        left: 84,
        top: 540,
        rot: -1.5,
      })
      s.worstLabel = put(root, 'dymo red', '最烂的设计', {
        left: 560,
        top: 540,
        rot: 1.2,
      })
      s.best = []
      s.worst = []
      const grads = [
        ['#7c3aed', '#3b82f6'],
        ['#ec4899', '#8b5cf6'],
        ['#6366f1', '#06b6d4'],
        ['#8b5cf6', '#f472b6'],
        ['#4f46e5', '#22d3ee'],
        ['#a855f7', '#3b82f6'],
        ['#6d28d9', '#14b8a6'],
        ['#7c3aed', '#f59e0b'],
        ['#3b82f6', '#a855f7'],
      ]
      const emojis = ['🚀', '✨', '💡', '🔥', '⚡', '🎯', '🌈', '🤖', '💎']
      for (let i = 0; i < 9; i++) {
        const col = i % 3
        const row = Math.floor(i / 3)
        s.best.push(
          put(
            root,
            'photo',
            `<img src="assets/gen/shot-0${i + 1}.jpg" style="position:static;width:132px;height:75px;object-fit:cover;object-position:top">`,
            {
              left: 84 + col * 150,
              top: 610 + row * 100,
              padding: '5px 5px 7px',
              rot: ((i * 37) % 7) - 3,
            },
          ),
        )
        s.worst.push(
          put(
            root,
            'photo',
            `<div style="width:132px;height:75px;border-radius:14px;background:linear-gradient(135deg,${grads[i][0]},${grads[i][1]});line-height:75px;text-align:center">${emo(emojis[i], '40px', 'middle')}</div>`,
            {
              left: 560 + col * 146,
              top: 610 + row * 100,
              padding: '5px 5px 7px',
              rot: ((i * 53) % 7) - 3,
            },
          ),
        )
      }
      s.avg = put(
        root,
        'photo',
        `<img src="assets/gen/average.jpg" style="position:static;display:block;width:620px;height:350px"><div class="cap" style="text-align:center">9 个优秀设计首页的逐像素平均</div>`,
        { left: 216, top: 580, rot: -1.5 },
      )
      s.avgStamp = put(root, 'stamp', '平均值', {
        left: 640,
        top: 560,
        fontSize: 56,
        rot: 8,
      })
      s.avgNote = put(root, 'note', '最安全，也最无聊', {
        left: 216,
        top: 1040,
        fontSize: 44,
        rot: -1,
      })

      s.b1 = put(root, 'h2', '真正的问题是：', {
        left: 84,
        top: 300,
        fontSize: 64,
      })
      s.b2 = put(root, 'hand', '作为 Vibe Coder，<br>你有没有一套审美标准？', {
        left: 84,
        top: 400,
        width: 912,
        fontSize: 58,
        lineHeight: '1.35',
        fontWeight: '700',
      })
      s.verbs = [
        ['去判断', 84, 610, -2],
        ['去约束', 320, 710, 1.5],
        ['去指导 AI', 556, 810, -1],
      ].map(([text, left, top, r]) =>
        put(root, 'dymo', text, {
          left,
          top,
          fontSize: 52,
          padding: '10px 26px 12px',
          rot: r,
        }),
      )
      s.start = put(root, 'note', '改变这一切的起点 ↓', {
        left: 84,
        top: 960,
        fontSize: 44,
      })
      s.ds = put(
        root,
        'paper lift',
        `<div class="tape" style="position:absolute;left:330px;top:-20px;transform:rotate(3deg)"></div>
         <div class="h1" style="font-size:112px;line-height:1.15">设计系统</div>
         <div style="font-family:Inter;font-weight:800;font-size:58px;letter-spacing:-0.01em;color:var(--ink-light)">Design System</div>`,
        { left: 84, top: 1040, width: 912, padding: '40px 56px 44px', rot: -1 },
      )
      return s
    },
    render(s, lt, c) {
      rise(s.q1, lt, 0.1)
      rise(s.q2, lt, c.W(0, '不是'))
      pop(s.bestLabel, lt, c.W(1, '最好'))
      s.best.forEach((el, i) =>
        pin(el, lt, c.W(1, '最好') + 0.1 + i * 0.06, { drop: 20, dur: 0.4 }),
      )
      pop(s.worstLabel, lt, c.W(1, '最烂'))
      s.worst.forEach((el, i) =>
        pin(el, lt, c.W(1, '最烂') + 0.1 + i * 0.06, { drop: 20, dur: 0.4 }),
      )
      // Everything collapses into the average.
      const merge = c.W(2, '平均值') - 0.5
      ;[...s.best, ...s.worst].forEach((el, i) => {
        const q = ease.inOut(prog(lt, merge + (i % 9) * 0.03, 0.55))
        if (q <= 0) return
        const x = parseFloat(el.style.left) + 71
        const y = parseFloat(el.style.top) + 43
        el.style.opacity = ((+el.style.opacity || 0) * (1 - q)).toFixed(3)
        el.style.transform = `translate3d(${((540 - x) * q).toFixed(1)}px, ${((760 - y) * q).toFixed(1)}px, 0) scale(${(1 - 0.6 * q).toFixed(3)}) ${el.style.transform}`
      })
      for (const el of [s.bestLabel, s.worstLabel])
        away(el, lt, merge, { dy: -10 })
      pin(s.avg, lt, merge + 0.45)
      slam(s.avgStamp, lt, c.W(2, '平均值') + 0.35)
      rise(s.avgNote, lt, c.E(2) - 0.4)
      const page = c.L(3) - 0.3
      for (const el of [s.q1, s.q2, s.avg, s.avgStamp, s.avgNote])
        away(el, lt, page)

      rise(s.b1, lt, c.L(3))
      rise(s.b2, lt, c.W(3, '作为'))
      s.verbs.forEach((v, i) =>
        pin(v, lt, c.W(3, ['判断', '约束', '指导'][i]), { drop: 30, dur: 0.5 }),
      )
      rise(s.start, lt, c.L(4))
      pin(s.ds, lt, c.W(4, '设计系统'))
    },
  },

  layers: {
    build(root) {
      const s = {}
      s.title = put(
        root,
        'h1',
        '设计系统 <span class="red" style="font-family:Inter;font-weight:800">≠</span> <span class="muted">UI 组件库</span>',
        { left: 84, top: 292, fontSize: 80 },
      )
      const layer = (label, title, box, extra = '') =>
        put(
          root,
          'paper',
          `<span class="dymo" style="position:absolute;left:24px;top:22px;font-size:20px">${label}</span>
           <div class="h2" style="position:absolute;left:26px;top:74px;font-size:50px">${title}</div>${extra}`,
          box,
        )
      s.l1 = layer(
        '顶层',
        '设计原则与哲学',
        { left: 234, top: 452, width: 612, height: 176, rot: -0.8 },
        `<div class="red" style="position:absolute;right:28px;top:84px;font-family:Inter;font-weight:800;font-size:44px">WHY</div>`,
      )
      s.l2 = layer('中层', '视觉规范', {
        left: 159,
        top: 660,
        width: 762,
        height: 250,
        rot: 0.6,
      })
      s.chips = ['色彩', '字体', '间距', '动效', '图标'].map((t, i) =>
        put(s.l2, '', t, {
          left: 26 + i * 146,
          top: 160,
          padding: '6px 22px 8px',
          border: '2.5px solid var(--ink)',
          borderRadius: '6px',
          fontWeight: '700',
          fontSize: 32,
        }),
      )
      s.l3 = layer(
        '底层',
        '可复用组件 · 代码实现',
        { left: 84, top: 942, width: 912, height: 176, rot: -0.5 },
        `<div class="red" style="position:absolute;right:32px;top:84px;font-family:Inter;font-weight:800;font-size:44px">HOW</div>`,
      )
      s.why = put(
        root,
        'hand',
        '我们为什么这样设计？<span class="red"> → 原则</span>',
        {
          left: 84,
          top: 1168,
          fontSize: 44,
          fontWeight: '700',
        },
      )
      s.how = put(
        root,
        'hand',
        '我们具体怎么做？<span class="red"> → 规范 + 组件</span>',
        {
          left: 84,
          top: 1252,
          fontSize: 44,
          fontWeight: '700',
        },
      )
      return s
    },
    render(s, lt, c) {
      rise(s.title, lt, 0.1)
      pin(s.l1, lt, c.W(1, '顶层'))
      pin(s.l2, lt, c.W(2, '中层'))
      s.chips.forEach((chip, i) =>
        pop(chip, lt, c.W(2, ['色彩', '字体', '间距', '动效', '图标'][i])),
      )
      pin(s.l3, lt, c.W(3, '底层'))
      rise(s.why, lt, c.W(4, '为什么'))
      rise(s.how, lt, c.W(4, '具体怎么做'))
    },
  },

  house: {
    build(root) {
      const s = {}
      s.title = put(
        root,
        'h1',
        '做产品 <span class="red" style="font-family:Inter">≈</span> 盖房子',
        { left: 84, top: 292, fontSize: 80 },
      )
      const icons = [
        '<path d="M20 90 L90 20 L90 90 Z"/><path d="M40 90 L40 76 M55 90 L55 80 M70 90 L70 76"/>',
        '<rect x="14" y="58" width="40" height="22"/><rect x="58" y="58" width="40" height="22"/><rect x="36" y="32" width="40" height="22"/>',
        '<path d="M30 16 H80 V96 H30 Z"/><path d="M42 38 H68 M42 54 H68 M42 70 H60"/>',
      ]
      s.cards = [
        ['建筑规范', '设计原则'],
        ['标准建材库', '组件库'],
        ['施工手册', '使用指南'],
      ].map(([title, sub], i) =>
        put(
          root,
          'paper',
          `<div style="position:absolute;inset:0;background-image:linear-gradient(rgba(57,124,120,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(57,124,120,.14) 1px,transparent 1px);background-size:24px 24px"></div>
           <svg viewBox="0 0 110 110" style="position:absolute;left:84px;top:38px;width:128px;height:128px;fill:none;stroke:var(--teal);stroke-width:4;stroke-linejoin:round">${icons[i]}</svg>
           <div class="h2" style="position:absolute;left:0;right:0;top:196px;text-align:center;font-size:40px">${title}</div>
           <div class="hand muted" style="position:absolute;left:0;right:0;top:256px;text-align:center;font-size:30px">= ${sub}</div>`,
          {
            left: 84 + i * 308,
            top: 432,
            width: 296,
            height: 330,
            rot: [-1.5, 1, -0.6][i],
          },
        ),
      )
      s.without = put(root, 'note', '没有它：', {
        left: 84,
        top: 812,
        fontSize: 50,
      })
      s.bad = ['门的尺寸各不相同', '电线乱拉', '墙厚薄不一'].map((t, i) => {
        const el = put(
          root,
          'h2 muted',
          `${t}<i style="position:absolute;left:-6px;right:-6px;top:52%;height:5px;background:var(--red);transform-origin:left center;transform:scaleX(0)"></i>`,
          {
            left: 124,
            top: 892 + i * 82,
            fontSize: 46,
          },
        )
        return el
      })
      s.left = put(
        root,
        'paper',
        `<span class="dymo" style="position:absolute;left:26px;top:24px;font-size:22px">AI 的设计输出</span>
         <img src="assets/gen/average.jpg" style="position:absolute;left:24px;top:88px;width:392px;height:222px;border:6px solid #fff;box-shadow:var(--shadow-paper)">
         <div class="h2" style="position:absolute;left:26px;top:344px;font-size:54px">统计平均</div>
         <div class="hand muted" style="position:absolute;left:28px;top:426px;font-size:32px">安全，但千篇一律</div>`,
        { left: 84, top: 300, width: 440, height: 500, rot: -1.2 },
      )
      const swatches = [
        '#1a1a1a',
        '#524f46',
        '#cc3333',
        '#397c78',
        '#b59a62',
        '#f9f6f0',
      ]
        .map(
          (col, i) =>
            `<i style="position:absolute;left:${26 + i * 62}px;top:96px;width:54px;height:54px;background:${col};border:1px solid rgba(0,0,0,.15)"></i>`,
        )
        .join('')
      const ramp = [56, 44, 34, 26, 20]
        .map(
          (size, i) =>
            `<span style="position:absolute;left:${26 + [0, 70, 128, 176, 214][i]}px;top:${250 - size}px;font-family:Inter;font-weight:700;font-size:${size}px;line-height:1">Aa</span>`,
        )
        .join('')
      s.right = put(
        root,
        'paper',
        `<span class="dymo" style="position:absolute;left:26px;top:24px;font-size:22px">设计系统</span>
         <div style="position:absolute;left:26px;top:170px;width:388px;height:1px;background:rgba(0,0,0,.2)"></div>${swatches}${ramp}
         <div style="position:absolute;left:250px;top:190px;width:164px;height:60px;border:2px solid var(--ink);border-radius:6px;font-weight:700;font-size:26px;line-height:56px;text-align:center">Button</div>
         <div class="h2" style="position:absolute;left:26px;top:318px;font-size:50px;line-height:1.2">经过验证的<br>最优解</div>`,
        { left: 556, top: 300, width: 440, height: 500, rot: 1 },
      )
      s.verified = put(root, 'stamp', 'VERIFIED', {
        left: 770,
        top: 700,
        fontSize: 36,
        rot: -10,
      })
      s.lead = put(root, 'lead', '理解了它背后的逻辑，你就能：', {
        left: 84,
        top: 846,
        fontSize: 40,
      })
      s.abilities = [
        '判断 AI 输出的好坏',
        '给出精确的约束',
        '犯错时知道怎么修',
      ].map((t, i) =>
        put(
          root,
          'h2',
          `<span class="red mono" style="font-weight:700">0${i + 1}</span> ${t}`,
          { left: 84, top: 916 + i * 74, fontSize: 44 },
        ),
      )
      s.noteCard = put(
        root,
        'paper lift',
        `<div class="tape" style="position:absolute;left:320px;top:-20px;transform:rotate(-3deg)"></div>
         <div class="hand" style="font-weight:700;font-size:58px;line-height:1.4">审美不是天赋，<br>是训练出来的<span style="position:relative;display:inline-block">判断力<svg class="ink mk" viewBox="0 0 200 30" preserveAspectRatio="none" style="position:absolute;left:-6px;bottom:-8px;width:calc(100% + 12px);height:24px"><path d="M4 18 C 60 8, 130 10, 196 16"/></svg></span>。</div>`,
        {
          left: 120,
          top: 1152,
          width: 840,
          padding: '26px 44px 30px',
          rot: -1.4,
        },
      )
      s.noteMark = $('.mk path', s.noteCard)
      return s
    },
    render(s, lt, c) {
      rise(s.title, lt, 0.1)
      s.cards.forEach((card, i) =>
        pin(card, lt, c.W(0, ['建筑规范', '标准建材库', '施工手册'][i])),
      )
      rise(s.without, lt, c.L(1))
      s.bad.forEach((el, i) => {
        const at = c.W(1, ['门的尺寸', '电线', '墙'][i])
        rise(el, lt, at)
        grow($('i', el), lt, at + 0.45, 0.35)
      })
      const page = c.L(2) - 0.3
      for (const el of [s.title, ...s.cards, s.without, ...s.bad])
        away(el, lt, page)
      pin(s.left, lt, c.L(2))
      pin(s.right, lt, c.W(2, '设计系统'))
      slam(s.verified, lt, c.W(2, '最优解') + 0.3)
      rise(s.lead, lt, c.L(3))
      s.abilities.forEach((el, i) =>
        rise(el, lt, c.W(3, ['判断', '精确', '犯错'][i])),
      )
      pin(s.noteCard, lt, c.L(4))
      draw(s.noteMark, lt, c.W(4, '判断力') + 0.2, 0.5)
    },
  },

  quote: {
    build(root) {
      const s = {}
      s.head = put(
        root,
        'h2',
        '设计大师 <span style="font-family:Inter;font-weight:800">Paul Rand</span>',
        { left: 84, top: 292, fontSize: 64 },
      )
      s.card = put(
        root,
        'paper lift',
        `<div class="tape washi" style="position:absolute;left:60px;top:-20px;transform:rotate(-5deg)"></div>
         <div style="position:absolute;left:36px;top:-34px;font-family:'Noto Serif SC';font-weight:700;font-size:200px;line-height:1;color:var(--red);opacity:.85">“</div>
         <div style="margin-top:70px;font-family:var(--serif);font-size:46px;line-height:1.72">
           <span class="s1">没有美学，设计要么是陈词滥调的单调重复，要么是对新奇的疯狂追逐。</span><span class="s2">没有美学，计算机不过是一台无意识的速度机器，</span><span class="s3">产生没有实质的效果、没有相关内容的形式，或没有有意义形式的内容。</span>
         </div>
         <div class="mono" style="margin-top:34px;text-align:right;font-size:26px;color:var(--ink-light)">— Paul Rand，被 IBM Design Language 官网引用</div>`,
        {
          left: 84,
          top: 410,
          width: 912,
          padding: '40px 64px 48px',
          rot: -0.8,
        },
      )
      s.parts = [$('.s1', s.card), $('.s2', s.card), $('.s3', s.card)]
      return s
    },
    render(s, lt, c) {
      rise(s.head, lt, 0.1)
      pin(s.card, lt, c.W(0, '有一句话'))
      const lit = [c.L(1), c.L(2), c.E(2) + 0.2]
      s.parts.forEach((part, i) => {
        const p = ease.out(prog(lt, lit[i], 0.6))
        part.style.opacity = lerp(0.16, i === 2 ? 0.5 : 1, p).toFixed(3)
      })
    },
  },

  index: {
    build(root) {
      const s = {}
      s.title = put(root, 'h1', '9 个世界级设计系统', {
        left: 84,
        top: 292,
        fontSize: 80,
      })
      s.cards = Object.values(SYSTEMS).map((sys, i) =>
        put(
          root,
          'paper',
          `<div class="stamp" style="position:absolute;left:20px;top:20px;font-size:34px;transform:rotate(-6deg)">${sys.no}</div>
           <div style="position:absolute;left:24px;right:18px;top:102px;font-family:Inter;font-weight:700;font-size:32px;line-height:1.15">${sys.name}</div>
           <div class="mono" style="position:absolute;left:24px;bottom:20px;font-size:23px;color:var(--ink-light)">${sys.tags[0]}</div>`,
          {
            left: 84 + (i % 3) * 316,
            top: 440 + Math.floor(i / 3) * 280,
            width: 280,
            height: 252,
            rot: [-2, 1.2, -0.8, 1.6, -1.4, 0.8, -0.6, 1.8, -1.6][i],
          },
        ),
      )
      s.stamp = put(root, 'stamp', '亿级用户验证 · 设计教科书', {
        left: 150,
        top: 1286,
        fontSize: 40,
        rot: -4,
      })
      return s
    },
    render(s, lt, c) {
      rise(s.title, lt, 0.1)
      s.cards.forEach((card, i) =>
        pin(card, lt, 0.35 + i * 0.3, { drop: 36, dur: 0.5 }),
      )
      slam(s.stamp, lt, c.W(1, '亿级'))
    },
  },

  table: {
    build(root) {
      const s = {}
      s.title = put(root, 'h2', '九系统速览：哪个适合你？', {
        left: 84,
        top: 290,
        fontSize: 60,
      })
      s.card = put(root, 'paper tbl', '', {
        left: 84,
        top: 388,
        width: 912,
        height: 978,
        rot: 0.4,
      })
      const cols = [
        [36, 250],
        [296, 226],
        [532, 262],
        [808, 80],
      ]
      const row = (cells, top, head) => {
        const r = put(s.card, `row${head ? ' head' : ''}`, '', {
          top,
          height: head ? 58 : 96,
        })
        cells.forEach((text, i) =>
          put(r, i === 0 && !head ? 'name' : '', text, {
            left: cols[i][0] - 36,
            width: cols[i][1],
            top: 0,
            bottom: 0,
          }),
        )
        return r
      }
      s.head = row(['设计系统', '核心气质', '最适合', '开源'], 22, true)
      s.rows = TABLE.map((cells, i) => row(cells, 86 + i * 96, false))
      return s
    },
    render(s, lt, c) {
      rise(s.title, lt, 0.1)
      pin(s.card, lt, 0.25, { drop: 30 })
      rise(s.head, lt, 0.55)
      s.rows.forEach((r, i) => rise(r, lt, 0.7 + i * 0.22, { dist: 14 }))
    },
  },

  step1: {
    build(root) {
      const s = stepHeader(root, 1, '选 1–2 个系统深入读，不要贪多')
      s.rows = [
        ['做移动端 / App', ['Apple HIG', 'Material Design 3']],
        ['做企业 SaaS / 后台', ['Microsoft Fluent 2', 'Carbon']],
        ['做创意 / 专业工具', ['Adobe Spectrum']],
        ['做营销 / 官网', ['Mozilla Protocol']],
        ['做协作 / AI 产品', ['Atlassian Design']],
        ['想补设计哲学', ['IBM Design Language', 'Google Design']],
      ].map(([need, picks], i) =>
        put(
          root,
          '',
          `<div class="h2" style="position:absolute;left:0;top:14px;width:340px;font-size:36px">${need}</div>
           <div class="red" style="position:absolute;left:338px;top:12px;font-family:Inter;font-weight:700;font-size:38px">→</div>
           <div style="position:absolute;left:392px;top:10px;width:520px;display:flex;flex-wrap:wrap;gap:10px">${picks
             .map(
               (p, k) =>
                 `<span class="dymo" style="font-size:22px;transform:rotate(${k ? 1 : -1.2}deg)">${p}</span>`,
             )
             .join('')}</div>`,
          { left: 84, top: 470 + i * 114, width: 912, height: 104 },
        ),
      )
      s.note = put(
        root,
        'paper',
        `<div class="h2" style="font-size:40px">重点读：设计原则 + Foundations</div>
         <div class="note" style="margin-top:12px;font-size:38px">理解“为什么”，比记住“是什么”重要十倍</div>`,
        {
          left: 84,
          top: 1170,
          width: 912,
          padding: '26px 36px 30px',
          rot: -0.8,
        },
      )
      return s
    },
    render(s, lt, c) {
      renderStepHeader(s, lt)
      const cues = [
        c.W(1, '移动端'),
        c.W(1, '企业'),
        c.W(1, '企业') + 1.0,
        c.W(2, '营销'),
        c.W(2, '营销') + 1.0,
        c.W(2, '设计哲学'),
      ]
      s.rows.forEach((r, i) => rise(r, lt, cues[i]))
      pin(s.note, lt, c.L(3))
    },
  },

  step2: {
    build(root) {
      const s = stepHeader(root, 2, '把设计原则写进你的 AI Prompt')
      s.bad = put(
        root,
        'paper',
        `<div class="h2" style="position:relative;display:inline-block;font-size:44px">“帮我做一个好看的登录页”<i style="position:absolute;left:-6px;right:-6px;top:52%;height:5px;background:var(--red);transform-origin:left center;transform:scaleX(0)"></i></div>`,
        { left: 84, top: 470, padding: '26px 34px 30px', rot: -1 },
      )
      s.badStamp = put(root, 'stamp', '= AI SLOP', {
        left: 700,
        top: 560,
        fontSize: 38,
        rot: -9,
      })
      s.term = put(
        root,
        'term',
        `<div class="bar" style="position:absolute">prompt · material-3.md</div><div class="body" style="position:absolute"></div>`,
        { left: 84, top: 660, width: 912, height: 560, rot: 0.4 },
      )
      s.body = $('.body', s.term)
      s.leap = put(root, 'stamp', '质的飞跃', {
        left: 640,
        top: 1218,
        fontSize: 56,
        rot: -8,
      })
      return s
    },
    render(s, lt, c) {
      renderStepHeader(s, lt)
      pin(s.bad, lt, c.L(1))
      grow($('i', s.bad), lt, c.W(1, '自由发挥'), 0.4)
      slam(s.badStamp, lt, c.W(1, 'AI Slop'))
      pin(s.term, lt, c.L(2) - 0.1)
      // Type the prompt from the article, line by line.
      const start = c.W(2, '具体的')
      if (CUE_LOG)
        CUE_LOG.push({
          kind: 'type',
          t: c.start + start,
          dur: PROMPT.flat().join('').length / 34,
        })
      let shown = Math.max(0, Math.floor((lt - start) * 34))
      let html = ''
      for (const [prefix, text] of PROMPT) {
        const full = prefix + text
        const n = Math.min(full.length, shown)
        shown -= n
        if (n === 0) break
        const visible = full.slice(0, n)
        html += `<span class="p">${visible.slice(0, prefix.length)}</span>${visible.slice(prefix.length)}${n < full.length ? '<span class="p">▌</span>' : ''}\n`
        if (n < full.length) break
      }
      s.body.innerHTML = html
      slam(s.leap, lt, c.W(3, '质的飞跃'))
    },
  },

  step3: {
    build(root) {
      const s = stepHeader(root, 3, '用组件库约束 AI 的输出')
      const pairs = [
        ['做一个导航栏', '使用 Material Design 3 的', 'Navigation Bar', '组件'],
        [
          '做个弹窗',
          '使用 Carbon 的',
          'Modal',
          '组件，size=sm，包含 primary 和 secondary action',
        ],
        [
          '做个数据表格',
          '使用 Fluent 2 的',
          'Details List',
          '组件，支持排序和筛选',
        ],
      ]
      s.rows = pairs.map(([bad, pre, component, post], i) => {
        const top = 470 + i * 292
        const b = put(
          root,
          'h2 muted',
          `<span class="red" style="font-family:Inter;font-weight:800">✕</span> <span style="position:relative">“${bad}”<i style="position:absolute;left:-4px;right:-4px;top:52%;height:4px;background:var(--red);transform-origin:left center;transform:scaleX(0)"></i></span>`,
          { left: 84, top, fontSize: 40 },
        )
        const g = put(
          root,
          'paper',
          `<div style="display:flex;align-items:flex-start;gap:18px"><span style="font-family:Inter;font-weight:800;font-size:44px;line-height:1.1;color:var(--teal)">✓</span><div style="font-weight:700;font-size:34px;line-height:1.55">“${pre} <span class="dymo" style="font-size:24px;vertical-align:4px">${component}</span> ${post}”</div></div>`,
          {
            left: 84,
            top: top + 76,
            width: 912,
            padding: '24px 32px 26px',
            rot: i % 2 ? 0.8 : -0.8,
          },
        )
        return { b, g }
      })
      return s
    },
    render(s, lt, c) {
      renderStepHeader(s, lt)
      const cues = [
        [c.L(1), c.W(1, '要说')],
        [c.L(2), c.W(2, '要说')],
        [c.W(2, '数据表格'), c.W(2, '数据表格') + 0.6],
      ]
      s.rows.forEach(({ b, g }, i) => {
        rise(b, lt, cues[i][0])
        grow($('i', b), lt, cues[i][1] - 0.2, 0.35)
        pin(g, lt, cues[i][1])
      })
    },
  },

  step4: {
    build(root) {
      const s = stepHeader(root, 4, '建立自己的“审美反馈循环”')
      const cards = [
        [
          '拆产品',
          '用到好看的 App 就停下来想：间距？色彩比例？字体层级？为什么这样设计？',
        ],
        ['对比 AI 输出', '对照规范找出至少 3 处不符合的地方，再让 AI 修改'],
        [
          '建参考库',
          '好设计截图按 色彩 / 排版 / 布局 / 动效 分类，需要时给 AI 看',
        ],
        ['读 Google Design', '每周读一篇，了解设计前沿和方法论'],
      ]
      const spots = [
        [84, 474],
        [566, 474],
        [566, 836],
        [84, 836],
      ]
      s.cards = cards.map(([title, body], i) =>
        put(
          root,
          'paper',
          `<div class="stamp" style="position:absolute;left:24px;top:22px;font-size:28px;transform:rotate(-6deg)">0${i + 1}</div>
           <div class="h2" style="position:absolute;left:28px;top:92px;right:24px;font-size:44px">${title}</div>
           <div class="hand muted" style="position:absolute;left:28px;right:26px;top:162px;font-size:31px;line-height:1.45">${body}</div>`,
          {
            left: spots[i][0],
            top: spots[i][1],
            width: 430,
            height: 334,
            rot: [-1.2, 1, -0.8, 1.4][i],
          },
        ),
      )
      s.loop = put(
        root,
        '',
        `<svg class="ink" viewBox="0 0 150 150" style="position:absolute;left:0;top:0;width:150px;height:150px;stroke-width:6"><path d="M75 12 A63 63 0 1 1 20 45"/><path d="M8 30 L20 45 L36 36"/></svg>`,
        { left: 465, top: 732, width: 150, height: 150 },
      )
      s.loopPaths = $$('path', s.loop)
      return s
    },
    render(s, lt, c) {
      renderStepHeader(s, lt)
      const cues = [c.L(1), c.L(2), c.L(3), c.W(3, 'Google Design')]
      s.cards.forEach((card, i) => pin(card, lt, cues[i]))
      draw(s.loopPaths[0], lt, c.L(1) + 0.4, c.L(3) - c.L(1) + 0.8)
      draw(s.loopPaths[1], lt, c.L(3) + 1.2, 0.3)
    },
  },

  closing: {
    build(root) {
      const s = {}
      s.a1 = put(root, 'h1', 'AI 是你手里的画笔，', {
        left: 84,
        top: 300,
        fontSize: 76,
      })
      s.a2 = put(
        root,
        'h1',
        '设计系统，<br>是教你怎么画画的<span class="red">老师</span>。',
        { left: 84, top: 404, fontSize: 76 },
      )
      s.a3 = put(root, 'hand muted', '画笔再好，不会画的人也只能涂鸦。', {
        left: 84,
        top: 640,
        fontSize: 50,
        fontWeight: '700',
      })
      s.scribble = put(
        root,
        '',
        inkPath(
          'M10 40 C 30 5, 45 70, 65 30 S 100 10, 110 45 S 150 60, 170 20 S 205 40, 225 30',
          [240, 70],
          5,
        ),
        { left: 760, top: 700, width: 240, height: 70 },
      )
      s.a4 = put(
        root,
        'paper lift',
        `<div class="h2 muted" style="position:relative;display:inline-block;font-size:44px">不要满足于“AI 能做出来”<i style="position:absolute;left:-6px;right:-6px;top:52%;height:5px;background:var(--red);transform-origin:left center;transform:scaleX(0)"></i></div>
         <div class="note" style="margin-top:18px;font-size:42px">要追求</div>
         <div class="h2" style="margin-top:8px;font-size:54px;line-height:1.35">“我知道什么是好的，<br>并且能让 AI 做出来”</div>`,
        { left: 84, top: 790, width: 912, padding: '36px 48px 42px', rot: -1 },
      )
      s.b1 = put(
        root,
        'paper lift',
        `<div class="tape washi" style="position:absolute;left:52px;top:-20px;transform:rotate(-4deg)"></div>
         <div class="note" style="font-size:44px">从今天开始：</div>
         <div class="h1" style="margin-top:10px;font-size:66px;line-height:1.3">选一个设计系统，<br>读它的设计原则页面。</div>
         <div style="margin-top:24px;display:flex;align-items:center;gap:20px"><span class="dymo" style="font-size:30px">30 MIN</span><span class="hand" style="font-size:36px">你看 AI 生成的界面时，眼光就会不一样</span></div>`,
        { left: 84, top: 300, width: 912, padding: '40px 48px 44px', rot: 0.8 },
      )
      s.end = put(
        root,
        'paper lift',
        `<div class="tape" style="position:absolute;right:60px;top:-20px;transform:rotate(4deg)"></div>
         <div style="display:flex;gap:14px"><span class="dymo" style="transform:rotate(-1.5deg)">AI开发</span><span class="dymo" style="transform:rotate(1deg)">VibeCoding</span></div>
         <div class="h1" style="margin-top:30px;font-size:72px">别再做 <span style="font-family:Inter;font-weight:800">AI Slop</span> 了</div>
         <div class="mono" style="margin-top:22px;font-size:32px;font-weight:700">~/jintaoblog/朝夕见闻志</div>
         <div class="mono red" style="margin-top:10px;font-size:32px;font-weight:700">jintaoblog.com/posts/611.html</div>
         <div class="mono" style="margin-top:22px;font-size:25px;color:var(--ink-light)">ShyNloc · 原文首发于 X @shynloc</div>`,
        {
          left: 84,
          top: 850,
          width: 912,
          padding: '40px 48px 42px',
          rot: -1.2,
        },
      )
      return s
    },
    render(s, lt, c) {
      rise(s.a1, lt, 0.1)
      rise(s.a2, lt, c.W(0, '设计系统'))
      rise(s.a3, lt, c.L(1))
      draw($('path', s.scribble), lt, c.W(1, '涂鸦'), 0.6)
      pin(s.a4, lt, c.L(2))
      grow($('i', s.a4), lt, c.W(2, '要追求') - 0.3, 0.35)
      const page = c.L(3) - 0.3
      for (const el of [s.a1, s.a2, s.a3, s.scribble, s.a4]) away(el, lt, page)
      s.scribble.style.opacity = s.scribble.style.opacity || '1'
      pin(s.b1, lt, c.L(3))
      pin(s.end, lt, c.W(3, '30 分钟'))
    },
  },
}

// ---------- system scenes (01–09) ----------

function buildSystem(root, sys, id) {
  const s = {}
  s.no = put(root, 'stamp', sys.no, {
    left: 84,
    top: 262,
    fontSize: 60,
    rot: -6,
  })
  s.name = put(root, '', sys.name, {
    left: 250,
    top: 250,
    width: 760,
    fontFamily: 'Inter',
    fontWeight: '800',
    fontSize: 60,
    lineHeight: '1.1',
    letterSpacing: '-0.015em',
    whiteSpace: 'nowrap',
  })
  s.tags = put(
    root,
    '',
    sys.tags
      .map(
        (t, i) =>
          `<span class="dymo" style="font-size:20px;transform:rotate(${[-1.5, 0.8, -0.6][i]}deg)">${t}</span>`,
      )
      .join(''),
    {
      left: 250,
      top: 334,
      width: 760,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px 12px',
    },
  )
  s.tag = put(
    root,
    'hand',
    `<span class="red">「</span>${sys.tagline}<span class="red">」</span>`,
    {
      left: 84,
      top: 446,
      width: 912,
      fontSize: 38,
      whiteSpace: 'nowrap',
    },
  )
  const n = Number(sys.no)
  s.photo = put(
    root,
    'photo',
    `<div class="tape" style="position:absolute;left:330px;top:-22px;transform:rotate(3deg);z-index:2"></div>
     <div class="shot" style="width:804px;height:452px"><img src="assets/gen/shot-0${n}.jpg" style="width:1100px"></div>
     <div class="cap">官网首页 · ${sys.url}</div>`,
    { left: 124, top: 524, rot: n % 2 ? -1 : 0.8 },
  )
  s.img = $('img', s.photo)
  s.spec = put(root, 'paper', '', {
    left: 84,
    top: 1076,
    width: 912,
    height: 290,
    rot: n % 2 ? 0.5 : -0.5,
  })
  s.body = put(s.spec, '', '', { left: 26, right: 26, top: 24, bottom: 20 })
  SPECS[id].build(s.body, s)
  return s
}

function renderSystem(s, lt, c, sys, id) {
  slam(s.no, lt, 0.1)
  rise(s.name, lt, 0.2)
  rise(s.tags, lt, 0.38)
  rise(s.tag, lt, 0.55)
  pin(s.photo, lt, 0.3, { drop: 40 })
  const scale = 804 / 1100
  const height = s.img.naturalHeight * scale
  const scroll = Math.max(0, height - 452)
  s.img.style.transform = `translate3d(0, ${(-scroll * ease.sine(prog(lt, 1.2, c.D - 1.6))).toFixed(2)}px, 0) scale(${scale})`
  const at = c.W(...sys.cue)
  pin(s.spec, lt, at - 0.15, { drop: 30 })
  SPECS[id].render(s, lt, c, at)
}

const specHeader = (text) =>
  `<span class="dymo" style="position:absolute;left:0;top:0;font-size:20px">${text}</span>`

const SPECS = {
  hig: {
    build(b, s) {
      b.innerHTML = specHeader('2026 · 八大设计原则')
      s.chips = [
        '目标感',
        '能动性',
        '责任感',
        '熟悉感',
        '灵活',
        '简洁',
        '匠心',
        '愉悦感',
      ].map((t, i) =>
        put(b, '', t, {
          left: (i % 4) * 216,
          top: 62 + Math.floor(i / 4) * 88,
          width: 196,
          height: 70,
          border: '2.5px solid var(--ink)',
          borderRadius: '6px',
          fontWeight: '700',
          fontSize: 32,
          lineHeight: '64px',
          textAlign: 'center',
        }),
      )
    },
    render(s, lt, c, at) {
      s.chips.forEach((chip, i) => pop(chip, lt, at + 0.2 + i * 0.1))
      const hot = prog(lt, c.W(2, '能动性'), 0.3)
      for (const i of [1, 2]) {
        s.chips[i].style.borderColor = hot > 0 ? 'var(--red)' : ''
        s.chips[i].style.color = hot > 0 ? 'var(--red)' : ''
        s.chips[i].style.background =
          hot > 0 ? `rgba(204,51,51,${(0.1 * hot).toFixed(3)})` : ''
      }
    },
  },
  m3: {
    build(b, s) {
      b.innerHTML = specHeader('5 个关键色 × 13 级色调 · 示意')
      const keys = [
        ['primary', '#6750A4'],
        ['secondary', '#625B71'],
        ['tertiary', '#7D5260'],
        ['error', '#B3261E'],
        ['neutral', '#605D62'],
      ]
      const tones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100]
      s.rows = keys.map(([label, hex], r) => {
        const row = put(
          b,
          '',
          `<span class="mono" style="position:absolute;left:0;top:4px;font-size:20px;font-weight:700">${label}</span>`,
          {
            left: 0,
            top: 52 + r * 34,
            width: 860,
            height: 30,
          },
        )
        tones.forEach((T, j) =>
          put(row, '', '', {
            left: 136 + j * 55,
            top: 0,
            width: 51,
            height: 28,
            background: tone(hex, T),
          }),
        )
        return row
      })
    },
    render(s, lt, c, at) {
      s.rows.forEach((row, r) => wipe(row, lt, at + 0.25 + r * 0.14, 0.6))
    },
  },
  fluent: {
    build(b, s) {
      b.innerHTML = specHeader('形状只有四种')
      const shapes = [
        [
          '<rect x="10" y="12" width="160" height="96" rx="8"/>',
          '矩形',
          'rectangle',
        ],
        ['<circle cx="90" cy="60" r="50"/>', '圆形', 'circle'],
        [
          '<rect x="6" y="28" width="168" height="64" rx="32"/>',
          '药丸形',
          'pill',
        ],
        [
          '<path d="M18 14 H162 Q170 14 170 22 V88 Q170 96 162 96 H56 L34 114 L38 96 H18 Q10 96 10 88 V22 Q10 14 18 14 Z"/>',
          '喙形',
          'beak',
        ],
      ]
      s.shapes = shapes.map(([svg, zh, en], i) =>
        put(
          b,
          '',
          `<svg viewBox="0 0 180 120" style="position:absolute;left:0;top:0;width:180px;height:120px;fill:var(--paper);stroke:var(--ink);stroke-width:4">${svg}</svg>
           <div style="position:absolute;left:0;top:124px;width:180px;text-align:center;font-weight:700;font-size:28px">${zh} <span class="mono muted" style="font-size:19px;font-weight:400">${en}</span></div>`,
          { left: i * 218, top: 50, width: 180, height: 170 },
        ),
      )
    },
    render(s, lt, c) {
      s.shapes.forEach((el, i) =>
        pop(el, lt, c.W(2, ['矩形', '圆形', '药丸形', '喙形'][i])),
      )
    },
  },
  spectrum: {
    build(b, s) {
      b.innerHTML = specHeader('11 级去饱和灰阶 · 字号比例 1.125 · 示意')
      const L = [98, 94, 89, 80, 70, 59, 48, 38, 28, 19, 11]
      const names = [50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900]
      s.grays = put(b, '', '', { left: 0, top: 50, width: 860, height: 90 })
      L.forEach((l, i) => {
        put(s.grays, '', '', {
          left: i * 78,
          top: 0,
          width: 72,
          height: 58,
          background: css(labToRgb([l, 0, 0])),
          border: '1px solid rgba(0,0,0,.12)',
        })
        put(s.grays, 'mono', String(names[i]), {
          left: i * 78,
          top: 62,
          width: 72,
          textAlign: 'center',
          fontSize: 17,
        })
      })
      const scale = (ratio, left, label) => {
        let html = `<span class="mono" style="position:absolute;left:0;top:18px;font-size:20px;font-weight:700">${label}</span>`
        let x = 120
        for (let n = 0; n < 6; n++) {
          const size = 17 * ratio ** n
          html += `<span style="position:absolute;left:${x.toFixed(0)}px;bottom:0;font-family:Inter;font-weight:700;font-size:${size.toFixed(1)}px;line-height:1">Aa</span>`
          x += size * 1.25 + 8
        }
        return put(b, '', html, { left, top: 152, width: 420, height: 46 })
      }
      s.scaleA = scale(1.125, 0, '1.125')
      s.scaleB = scale(1.25, 440, '常见 1.25')
      s.scaleB.style.color = 'var(--ink-light)'
    },
    render(s, lt, c, at) {
      wipe(s.grays, lt, at + 0.2, 0.9)
      rise(s.scaleA, lt, c.W(2, '1.125'))
      rise(s.scaleB, lt, c.W(2, '1.25'))
    },
  },
  atlassian: {
    build(b, s) {
      b.innerHTML = specHeader('语义化 Design Token')
      const roles = [
        ['neutral', '#758195'],
        ['brand', '#0c66e4'],
        ['information', '#1d7afc'],
        ['success', '#22a06b'],
        ['warning', '#e2b203'],
        ['danger', '#e34935'],
        ['discovery', '#8270db'],
        ['accent', '#1d9aaa'],
        ['inverse', '#172b4d'],
        ['input', '#ffffff'],
      ]
      s.roles = put(
        b,
        '',
        roles
          .map(
            ([name, col]) =>
              `<span style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px 6px;border:1.5px solid rgba(26,26,26,.28);border-radius:999px;font-family:var(--mono);font-weight:700;font-size:20px"><i style="width:14px;height:14px;border-radius:50%;background:${col};border:1px solid rgba(0,0,0,.25)"></i>${name}</span>`,
          )
          .join(''),
        {
          left: 0,
          top: 50,
          width: 610,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '9px 8px',
        },
      )
      s.token = put(
        b,
        '',
        `<i style="display:inline-block;width:18px;height:18px;margin-right:12px;background:#e34935;vertical-align:-2px"></i>color.text.accent.red`,
        {
          left: 0,
          top: 196,
          fontFamily: 'var(--code)',
          fontSize: 26,
          fontWeight: '700',
        },
      )
      s.file = put(
        b,
        'paper',
        `<div style="position:absolute;left:20px;top:22px;font-family:var(--code);font-weight:700;font-size:25px">DESIGN.md</div>
         <div style="position:absolute;left:20px;right:30px;top:68px;height:8px;background:rgba(0,0,0,.14)"></div>
         <div style="position:absolute;left:20px;right:60px;top:88px;height:8px;background:rgba(0,0,0,.14)"></div>
         <div style="position:absolute;left:20px;right:40px;top:108px;height:8px;background:rgba(0,0,0,.14)"></div>
         <div class="hand red" style="position:absolute;left:20px;right:12px;top:130px;font-size:24px;line-height:1.35;font-weight:700">设计上下文<br>随项目携带</div>`,
        {
          left: 630,
          top: 40,
          width: 230,
          height: 206,
          clipPath: 'polygon(0 0, 84% 0, 100% 14%, 100% 100%, 0 100%)',
          rot: 2,
        },
      )
    },
    render(s, lt, c, at) {
      rise(s.roles, lt, at + 0.15)
      rise(s.token, lt, c.W(2, 'token 名称'))
      pin(s.file, lt, c.W(3, 'DESIGN.md'), { drop: 20 })
    },
  },
  carbon: {
    build(b, s) {
      b.innerHTML = specHeader('2x Grid · 2 → 64 列')
      s.grid = put(b, '', '', {
        left: 0,
        top: 52,
        width: 860,
        height: 86,
        border: '2px solid var(--ink)',
      })
      s.cols = Array.from({ length: 64 }, (_, i) =>
        put(s.grid, '', '', { top: 0, bottom: 0 }),
      )
      s.count = put(b, 'mono', '', {
        left: 0,
        top: 146,
        fontSize: 30,
        fontWeight: '700',
      })
      s.fw = put(
        b,
        '',
        '<span class="dymo" style="font-size:20px">React</span><span class="dymo" style="font-size:20px">Web Components</span><span class="dymo red" style="font-size:20px">MCP → AI 工作流</span>',
        { left: 0, top: 196, display: 'flex', gap: '12px' },
      )
      s.fwItems = [...s.fw.children]
    },
    render(s, lt, c, at) {
      const steps = [2, 4, 8, 16, 32, 64]
      const k = clamp(Math.floor((lt - at - 0.2) / 0.38), 0, steps.length - 1)
      const n = lt < at ? 2 : steps[k]
      const w = 856 / n
      s.cols.forEach((col, i) => {
        col.style.display = i < n ? 'block' : 'none'
        col.style.left = `${(i * w).toFixed(2)}px`
        col.style.width = `${w.toFixed(2)}px`
        col.style.background =
          i % 2 ? 'rgba(15,98,254,.26)' : 'rgba(15,98,254,.1)'
      })
      s.count.innerHTML =
        steps
          .map((v) => (v === n ? `<span class="red">${v}</span>` : v))
          .join(' → ') + ' 列'
      rise(s.fwItems[0], lt, c.W(2, 'React'))
      rise(s.fwItems[1], lt, c.W(2, 'Web Components'))
      pop(s.fwItems[2], lt, c.W(3, 'MCP'))
      s.fwItems[2].style.transform = `${s.fwItems[2].style.transform} rotate(-2deg)`
    },
  },
  ibm: {
    build(b, s) {
      b.innerHTML = specHeader('Uniquely Unified · 独特而统一')
      s.brand = put(
        b,
        '',
        `<div style="position:absolute;left:24px;top:12px;font-family:Inter;font-weight:800;font-size:92px;letter-spacing:-0.02em">IBM</div>
         <i style="position:absolute;left:14px;top:30px;width:230px;height:76px;background:var(--ink);transform-origin:left center;transform:scaleX(0)"></i>`,
        {
          left: 0,
          top: 54,
          width: 280,
          height: 130,
          border: '2px dashed rgba(26,26,26,.3)',
        },
      )
      s.bar = $('i', s.brand)
      s.ask = put(b, 'note', '遮住名字，<br>还能认出来吗？', {
        left: 300,
        top: 70,
        fontSize: 36,
        lineHeight: '1.4',
      })
      s.blue = put(
        b,
        '',
        `<i style="position:absolute;left:0;top:0;width:118px;height:84px;background:#0f62fe"></i><i style="position:absolute;left:128px;top:0;width:118px;height:84px;background:#da1e28"></i>
         <div class="hand" style="position:absolute;left:0;top:92px;width:290px;font-size:23px;line-height:1.35">Blue at the core<br>“即使红色也带有一丝蓝色”</div>`,
        { left: 576, top: 56, width: 290, height: 160 },
      )
    },
    render(s, lt, c, at) {
      rise(s.brand, lt, at - 0.1)
      grow(s.bar, lt, at + 0.3, 0.35)
      rise(s.ask, lt, c.W(2, '还能认出'))
      rise(s.blue, lt, c.L(3))
    },
  },
  protocol: {
    build(b, s) {
      b.innerHTML = specHeader('uniwidth · 切换字重，宽度不变 · 示意')
      s.rule = put(
        b,
        'hand',
        '“如果设计的某个方面不能增强内容，就应该移除它。”',
        { left: 0, top: 50, fontSize: 30, fontWeight: '700' },
      )
      const row = (label, family, top) => {
        const r = put(
          b,
          '',
          `<div style="position:absolute;left:0;top:12px;font-weight:700;font-size:28px">${label}</div>`,
          { left: 0, top, width: 860, height: 64 },
        )
        const btn = put(r, '', 'Download Firefox', {
          left: 190,
          top: 0,
          padding: '10px 24px 12px',
          border: '2.5px solid var(--ink)',
          borderRadius: '8px',
          fontFamily: family,
          fontSize: 28,
          whiteSpace: 'nowrap',
        })
        return { r, btn }
      }
      s.a = row('普通字体', 'Inter', 100)
      s.b = row('uniwidth', 'var(--code)', 172)
      s.noteA = put(b, 'hand red', '← 宽度跳动', {
        left: 520,
        top: 110,
        fontSize: 28,
        fontWeight: '700',
      })
      s.noteB = put(b, 'hand', '← 布局不抖', {
        left: 520,
        top: 182,
        fontSize: 28,
        fontWeight: '700',
        color: 'var(--teal)',
      })
    },
    render(s, lt, c, at) {
      rise(s.rule, lt, at)
      const demo = c.W(3, 'uniwidth')
      rise(s.a.r, lt, demo)
      rise(s.b.r, lt, demo + 0.15)
      const heavy = lt > demo && Math.floor((lt - demo) / 0.5) % 2 === 1
      s.a.btn.style.fontWeight = heavy ? '800' : '400'
      s.b.btn.style.fontWeight = heavy ? '700' : '400'
      rise(s.noteA, lt, demo + 0.8)
      rise(s.noteB, lt, demo + 1.1)
    },
  },
  google: {
    build(b, s) {
      b.innerHTML = specHeader('Design is never done · 设计永无止境')
      s.titles = [
        'Code is a Design Material',
        'Designing for Transparent Screens',
        'Making Google Sans Flex',
      ].map((t, i) =>
        put(
          b,
          '',
          `${t}<span class="mono muted" style="margin-left:14px;font-size:18px;font-weight:400">→ design.google</span>`,
          {
            left: 0,
            top: 54 + i * 58,
            width: 860,
            paddingBottom: '8px',
            borderBottom: '1.5px solid rgba(26,26,26,.2)',
            fontFamily: 'Inter',
            fontWeight: '700',
            fontSize: 34,
            whiteSpace: 'nowrap',
          },
        ),
      )
    },
    render(s, lt, c, at) {
      s.titles.forEach((el, i) => rise(el, lt, at + 0.2 + i * 0.3))
    },
  },
}

for (const id of Object.keys(SYSTEMS)) {
  SCENES[id] = {
    build: (root) => buildSystem(root, SYSTEMS[id], id),
    render: (s, lt, c) => renderSystem(s, lt, c, SYSTEMS[id], id),
  }
}

// ---------- global chrome ----------

let TIMELINE
let SUBS = []
const built = []

function renderChrome(t) {
  const duration = TIMELINE.duration
  $('#topbar .progress b').style.transform =
    `scaleX(${clamp(t / duration).toFixed(5)})`
  const current =
    built.find((b) => t >= b.scene.start && t < b.scene.end) ??
    built[built.length - 1]
  const chapter = $('#chapter')
  if (chapter.textContent !== current.scene.chapter)
    chapter.textContent = current.scene.chapter

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

function render(t) {
  for (const b of built) {
    const { scene, root, state, cues, def } = b
    const lt = t - scene.start
    const on = lt >= -0.02 && lt < cues.D + 0.02
    root.style.visibility = on ? 'visible' : 'hidden'
    if (!on) continue
    def.render(state, lt, cues)
    const out = ease.in(prog(lt, cues.D - 0.32, 0.32))
    root.style.opacity = (1 - out).toFixed(3)
    root.style.transform =
      out > 0 ? `translate3d(0, ${(-26 * out).toFixed(2)}px, 0)` : ''
  }
  renderChrome(t)
}

function collectCues() {
  CUE_LOG = []
  for (const b of built) {
    CUE_BASE = b.scene.start
    b.def.render(b.state, 0, b.cues)
    CUE_LOG.push({ kind: 'scene', t: b.scene.start, id: b.scene.id })
  }
  const seen = new Set()
  const cues = CUE_LOG.filter((c) => {
    const key = `${c.kind}@${c.t.toFixed(3)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.t - b.t)
  CUE_LOG = null
  return cues
}

// ---------- boot ----------

async function loadFonts() {
  const text =
    $('#stage').textContent +
    SUBS.map((s) => s.text).join('') +
    PROMPT.flat().join('') +
    [...new Set(TIMELINE.scenes.map((s) => s.chapter))].join('') +
    '0123456789→▌'
  const specs = [
    '400 40px Inter',
    '500 40px Inter',
    '600 40px Inter',
    '700 40px Inter',
    '800 40px Inter',
    '400 40px "Noto Sans SC"',
    '700 40px "Noto Sans SC"',
    '400 40px "Noto Serif SC"',
    '700 40px "Noto Serif SC"',
    '500 40px "LXGW WenKai"',
    '700 40px "LXGW WenKai"',
    '400 40px "Courier Prime"',
    '700 40px "Courier Prime"',
    '400 40px "Fira Code"',
    '700 40px "Fira Code"',
    '400 40px "CJK Punct"',
    '700 40px "CJK Punct"',
    '400 40px "CJK Punct Serif"',
  ]
  await Promise.all(specs.map((spec) => document.fonts.load(spec, text)))
  await document.fonts.ready
  window.__missingFonts = specs.filter(
    (spec) => !document.fonts.check(spec, text),
  )
}

async function boot() {
  TIMELINE = await (await fetch('../timeline.json')).json()
  SUBS = TIMELINE.scenes.flatMap((s) => s.lines.flatMap((l) => l.subs))
  const host = $('#scenes')
  for (const scene of TIMELINE.scenes) {
    const def = SCENES[scene.id]
    if (!def) throw new Error(`no visuals for scene ${scene.id}`)
    const root = document.createElement('section')
    root.className = 'scene'
    root.dataset.id = scene.id
    host.appendChild(root)
    built.push({
      scene,
      root,
      def,
      cues: new Cues(scene),
      state: def.build(root),
    })
  }
  await loadFonts()
  await Promise.all(
    [...document.images].map((img) => img.decode().catch(() => {})),
  )
  window.__duration = TIMELINE.duration
  window.__cues = collectCues()
  window.renderFrame = render
  render(0)
  window.__ready = true
}

boot().catch((error) => {
  console.error(error)
  window.__bootError = String(error)
})
