// Shared helpers: math, easing, DOM, motion, deterministic noise, narration cues.
// Every visual property is a pure function of t, so frames render in any order.

// ---------- math ----------

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
export const lerp = (a, b, p) => a + (b - a) * p
export const prog = (t, start, dur) => clamp((t - start) / dur)
export const TAU = Math.PI * 2

// CSS-style cubic-bézier timing function: solve x(s) = x by Newton steps
// (with a bisection fallback where the slope is flat), then return y(s).
function cubicBezier(x1, y1, x2, y2) {
  const coeff = (p1, p2) => [3 * p1, 3 * (p2 - p1) - 3 * p1, 1 - 3 * (p2 - p1)]
  const [ax, bx, cx] = coeff(x1, x2).reverse()
  const [ay, by, cy] = coeff(y1, y2).reverse()
  const X = (s) => ((ax * s + bx) * s + cx) * s
  const Y = (s) => ((ay * s + by) * s + cy) * s
  const dX = (s) => (3 * ax * s + 2 * bx) * s + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let s = x
    for (let i = 0; i < 8; i++) {
      const err = X(s) - x
      if (Math.abs(err) < 1e-7) return Y(s)
      const slope = dX(s)
      if (Math.abs(slope) < 1e-6) break
      s -= err / slope
    }
    let lo = 0
    let hi = 1
    s = x
    for (let i = 0; i < 50 && hi - lo > 1e-7; i++) {
      if (X(s) < x) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return Y(s)
  }
}

export const ease = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.55, 0, 0.9, 0.3),
  sine: (x) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2,
  back: (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const c1 = 1.7
    const c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
  },
  // Stepped: quantises progress, for the low-frame-rate eras.
  steps: (n) => (x) => Math.floor(clamp(x) * n) / n,
}

// ---------- deterministic noise ----------

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hash of integers → [0, 1).
export function hash(...n) {
  let h = 2166136261
  for (const v of n) {
    h ^= v | 0
    h = Math.imul(h, 16777619)
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
  }
  return (h >>> 0) / 4294967296
}

// Smooth 1-D value noise.
export function noise1(x, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i, seed), hash(i + 1, seed), u)
}

// ---------- DOM ----------

export const $ = (selector, root = document) => root.querySelector(selector)
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
]

// Style keys whose bare numbers mean pixels.
const PX = new Set(['left', 'top', 'right', 'bottom', 'width', 'height', 'fontSize'])
const cssValue = (key, value) => (typeof value === 'number' && PX.has(key) ? `${value}px` : value)

// Absolutely positioned element with inline styles, appended to parent.
export function put(parent, cls, html = '', box = {}, tag = 'div') {
  const el = Object.assign(document.createElement(tag), { className: cls || '' })
  if (html) el.innerHTML = html
  el.style.position = 'absolute'
  for (const key in box) el.style[key] = cssValue(key, box[key])
  parent.appendChild(el)
  return el
}

export function canvas(parent, w = 1080, h = 1920, box = {}) {
  const c = put(parent, '', '', { left: 0, top: 0, width: w, height: h, ...box }, 'canvas')
  c.width = w
  c.height = h
  return c
}

export function style(el, props) {
  for (const key in props) {
    const v = cssValue(key, props[key])
    if (el.style[key] !== v) el.style[key] = v
  }
}

export const px = (n) => `${n.toFixed(2)}px`

// ---------- motion ----------

export function fade(el, lt, start, dur = 0.4) {
  const p = prog(lt, start, dur)
  el.style.opacity = p.toFixed(3)
  el.style.visibility = p > 0 ? 'inherit' : 'hidden'
  return p
}

export function rise(el, lt, start, { dur = 0.6, dist = 30, base = '' } = {}) {
  const p = prog(lt, start, dur)
  const e = ease.out(p)
  el.style.opacity = clamp(p * 2).toFixed(3)
  el.style.visibility = p > 0 ? 'inherit' : 'hidden'
  el.style.transform = `translate3d(0, ${((1 - e) * dist).toFixed(2)}px, 0) ${base}`
  return p
}

export function pop(el, lt, start, { dur = 0.45, from = 0.5, base = '' } = {}) {
  const p = prog(lt, start, dur)
  el.style.opacity = clamp(p * 3).toFixed(3)
  el.style.visibility = p > 0 ? 'inherit' : 'hidden'
  el.style.transform = `${base} scale(${lerp(from, 1, ease.back(p)).toFixed(4)})`
  return p
}

// Multiplies the current opacity down to 0 (call after the element's entrance).
export function away(el, lt, start, { dur = 0.35, dy = 0 } = {}) {
  const q = ease.in(prog(lt, start, dur))
  if (q <= 0) return 0
  el.style.opacity = ((+el.style.opacity || 0) * (1 - q)).toFixed(3)
  if (dy) el.style.transform = `translate3d(0, ${(dy * q).toFixed(2)}px, 0) ${el.style.transform}`
  if (q >= 1) el.style.visibility = 'hidden'
  return q
}

export function typeText(el, text, lt, start, cps = 24, cursor = '') {
  if (lt < start) {
    if (el.textContent !== '') el.textContent = ''
    return 0
  }
  const chars = [...text]
  const n = Math.min(chars.length, Math.floor((lt - start) * cps) + 1)
  const blink = Math.floor(lt * 2.2) % 2 === 0
  const out = chars.slice(0, n).join('') + (cursor && (n < chars.length || blink) ? cursor : '')
  if (el.textContent !== out) el.textContent = out
  return n / chars.length
}

export function draw(path, lt, start, dur = 0.5, easing = ease.out) {
  if (path.__len === undefined) path.__len = path.getTotalLength()
  const p = easing(prog(lt, start, dur))
  path.style.strokeDasharray = `${path.__len} ${path.__len + 4}`
  path.style.strokeDashoffset = (path.__len * (1 - p)).toFixed(2)
  path.style.visibility = p > 0 ? 'inherit' : 'hidden'
  return p
}

// ---------- sound cues ----------
// Scene renderers call sfx(kind, start) at the moment an event begins; running
// every renderer once with CUE.log set collects the list for scripts/music.py.

export const CUE = { log: null, base: 0 }

export function sfx(kind, start, extra = {}) {
  if (CUE.log) CUE.log.push({ kind, t: +(CUE.base + start).toFixed(3), ...extra })
}

// ---------- narration cues ----------
// Times inside a scene, taken from timeline.json. Within a line, speech is
// assumed to advance by reading weight: CJK characters 1, Latin letters and
// digits 0.45, punctuation and spaces 0.15.

const readWeight = (ch) =>
  /[　-〿㐀-鿿＀-￯]/.test(ch) ? 1 : /[A-Za-z0-9]/.test(ch) ? 0.45 : 0.15

export class Cues {
  constructor(scene) {
    this.scene = scene
    this.start = scene.start
    this.D = scene.end - scene.start
  }
  // Start / end of line k, relative to the scene.
  L(k) {
    return this.scene.lines[k].start - this.start
  }
  E(k) {
    return this.scene.lines[k].end - this.start
  }
  // The moment line k reaches `phrase`.
  W(k, phrase) {
    const { text, start, end } = this.scene.lines[k]
    const at = text.indexOf(phrase)
    if (at < 0) throw new Error(`cue “${phrase}” not in ${this.scene.id}[${k}]`)
    const chars = [...text.slice(0, at)]
    const before = chars.reduce((sum, ch) => sum + readWeight(ch), 0)
    const total = [...text].reduce((sum, ch) => sum + readWeight(ch), 0)
    return start - this.start + (end - start) * (before / total)
  }
}

// ---------- number formatting ----------

export const groupDigits = (n) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
