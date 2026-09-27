// Eras 0–4: the switch, Turing's tape, ENIAC, the transistor and chip, Apollo + ARPANET.

import {
  $,
  $$,
  TAU,
  away,
  canvas,
  clamp,
  draw,
  ease,
  fade,
  groupDigits,
  hash,
  lerp,
  noise1,
  pop,
  prog,
  put,
  rise,
  rng,
  sfx,
  style,
  typeText,
} from './lib.js'

// A two-state value that flips at the given times, with a short eased swing.
function flips(lt, events, dur = 0.16) {
  let v = events.initial ?? 0
  let from = v
  let p = 1
  for (const [t, value] of events.list) {
    if (lt >= t) {
      from = v
      v = value
      p = prog(lt, t, dur)
    }
  }
  return { v, from, p, x: lerp(from, v, ease.back(p)) }
}

// Film grain tiles, generated once (seeded) and cycled per frame.
let GRAIN = null
function grainTiles() {
  if (GRAIN) return GRAIN
  GRAIN = []
  const r = rng(1946)
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(256, 256)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    GRAIN.push(c.toDataURL('image/png'))
  }
  return GRAIN
}

function grainLayer(root, opacity = 0.09, blend = 'overlay') {
  const tiles = grainTiles()
  const el = put(root, 'fill', '', {
    backgroundImage: `url(${tiles[0]})`,
    backgroundSize: '256px 256px',
    opacity: String(opacity),
    mixBlendMode: blend,
    zIndex: 8,
  })
  el.tick = (lt, fps = 24) => {
    const f = Math.floor(lt * fps)
    el.style.backgroundImage = `url(${tiles[f % tiles.length]})`
    el.style.backgroundPosition = `${Math.floor(hash(f, 1) * 256)}px ${Math.floor(hash(f, 2) * 256)}px`
  }
  return el
}

// Static paper fibre texture (SVG turbulence as a data URI).
const PAPER_NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`

const PENCIL_FILTER = `<filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4"/></filter>`

export const SCENES = {
  // ================================================================ 序章
  cold: {
    wipe: '#ffffff',
    hud: () => false,
    build(root, c) {
      const s = {}
      root.style.background = '#000'
      s.glow = put(root, 'fill', '', {
        background:
          'radial-gradient(circle at 50% 40%, rgba(255,226,170,0.42), rgba(255,226,170,0.08) 38%, rgba(0,0,0,0) 62%)',
        opacity: '0',
      })
      s.stream = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.bits = []
      for (let i = 0; i < 18; i++) {
        s.bits.push(
          put(s.stream, 'abs center', '', {
            left: 510,
            top: 0,
            width: 60,
            height: 70,
            fontFamily: 'var(--mono)',
            fontWeight: '700',
            fontSize: 54,
            color: '#fff',
            opacity: '0',
          }),
        )
      }
      s.dot = put(root, '', '', {
        left: 531,
        top: 711,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
      })
      s.swWrap = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.sw = put(
        s.swWrap,
        '',
        `<svg width="280" height="460" viewBox="-140 -230 280 460">
          <rect class="track draw" x="-100" y="-200" width="200" height="400" rx="100" stroke="#fff" stroke-width="7"/>
          <rect class="fillr" x="-100" y="-200" width="200" height="400" rx="100" fill="#fff" opacity="0"/>
          <circle class="knob" r="76" fill="#fff"/>
        </svg>`,
        { left: 400, top: 490 },
      )
      s.track = $('.track', s.sw)
      s.fillr = $('.fillr', s.sw)
      s.knob = $('.knob', s.sw)
      const label = (html, top) =>
        put(s.swWrap, 'abs', html, {
          left: 720,
          top,
          fontFamily: 'var(--mono)',
          fontSize: 40,
          fontWeight: '700',
          color: '#fff',
          letterSpacing: '0.08em',
        })
      s.lblOn = label('1 <span style="font-family:var(--sans)">开</span>', 518)
      s.lblOff = label('0 <span style="font-family:var(--sans)">关</span>', 868)
      s.digit = put(s.swWrap, 'abs center', '', {
        left: 290,
        top: 990,
        width: 500,
        height: 240,
        fontFamily: 'var(--mono)',
        fontWeight: '700',
        fontSize: 220,
        color: '#fff',
      })
      s.years = put(s.swWrap, 'abs center', '', {
        left: 190,
        top: 1040,
        width: 700,
        height: 150,
        fontFamily: 'var(--mono)',
        fontWeight: '700',
        fontSize: 132,
        color: '#fff',
      })
      s.bubble = put(
        s.swWrap,
        'abs',
        '<span class="t"></span>',
        {
          left: 640,
          top: 360,
          padding: '22px 36px 24px',
          borderRadius: '44px 44px 44px 8px',
          background: '#fff',
          color: '#000',
          fontSize: 64,
          fontWeight: '700',
          fontFamily: 'var(--sans)',
          whiteSpace: 'nowrap',
          transformOrigin: '0% 100%',
        },
      )
      s.bubbleText = $('.t', s.bubble)

      // Title card (after the last line).
      s.title = put(
        root,
        'abs',
        `<div style="font-family:var(--mono);font-size:30px;letter-spacing:0.5em;opacity:.7">1936 → 2026</div>
         <div class="tt" style="margin-top:34px;font-family:'Noto Sans SC';font-weight:900;font-size:168px;line-height:1.05;letter-spacing:0.04em">开关的觉醒</div>
         <div style="margin-top:34px;height:8px;width:180px;background:var(--amber)"></div>
         <div style="margin-top:40px;font-size:46px;font-weight:700;line-height:1.45">从图灵的纸带，<br>到会说话的 AI</div>
         <div style="margin-top:70px;font-size:28px;line-height:1.6;opacity:.6">＊ 本片的画面与配乐，<br>会跟着时代一起升级</div>`,
        { left: 96, top: 700, width: 900, color: '#fff' },
      )
      s.titleMain = $('.tt', s.title)

      // Flip schedule: on at 开, off at 关, a heartbeat of flips during line 2,
      // then on for good at “说话”.
      const list = [
        [c.W(1, '开'), 1],
        [c.W(1, '要么关'), 0],
      ]
      const beat = [0.0, 0.36, 0.72, 0.96, 1.2, 1.56]
      beat.forEach((d, i) => list.push([c.L(2) + 0.1 + d, i % 2 === 0 ? 1 : 0]))
      list.push([c.W(3, '九十年'), 1])
      s.flipEvents = { initial: 0, list }
      s.bitTimes = list.slice(2, 8)
      return s
    },
    render(s, lt, c) {
      // The dot: a blinking cursor that becomes the switch.
      const born = prog(lt, 0.3, 0.3)
      const blink = lt < 1.6 ? (Math.floor(lt * 3) % 2 === 0 ? 1 : 0.15) : 1
      const toSwitch = prog(lt, 1.6, 0.6)
      s.dot.style.opacity = (born * blink * (1 - toSwitch)).toFixed(3)
      s.dot.style.transform = `scale(${lerp(1, 6, ease.in(toSwitch)).toFixed(3)})`
      draw(s.track, lt, 1.7, 1.2)
      const knobIn = prog(lt, 2.4, 0.5)
      s.knob.style.opacity = knobIn.toFixed(3)

      const f = flips(lt, s.flipEvents)
      for (const [t] of s.flipEvents.list) sfx('click', t)
      s.flipEvents.list.forEach(([t]) => sfx('click', t))
      const y = lerp(120, -120, f.x)
      s.knob.setAttribute('cy', y.toFixed(2))
      s.knob.setAttribute('fill', f.v ? '#000' : '#fff')
      s.fillr.setAttribute('opacity', (f.v ? ease.out(f.p) : 1 - ease.out(f.p)) * (f.v || f.from ? 1 : 0))
      const lit = f.v ? ease.out(f.p) : 1 - ease.out(f.p)
      s.glow.style.opacity = (lit * clamp((lt - c.W(1, '开')) * 10)).toFixed(3)
      s.lblOn.style.opacity = (fade(s.lblOn, lt, 2.8, 0.4) * (0.35 + 0.65 * lit)).toFixed(3)
      s.lblOff.style.opacity = (fade(s.lblOff, lt, 2.8, 0.4) * (0.35 + 0.65 * (1 - lit))).toFixed(3)

      // Big digit mirrors the state, until the years take over.
      const digitOn = prog(lt, c.W(1, '开') - 0.02, 0.05)
      const yearsOn = prog(lt, c.W(3, '九十年'), 0.15)
      s.digit.textContent = f.v ? '1' : '0'
      s.digit.style.opacity = (digitOn * (1 - yearsOn)).toFixed(3)

      // Each flip in line 2 drops a bit that joins a stream along the bottom.
      s.bits.forEach((el, i) => {
        const ev = s.bitTimes[i]
        if (!ev) {
          el.style.opacity = '0'
          return
        }
        const [t, v] = ev
        const p = prog(lt, t, 0.7)
        el.textContent = String(v)
        const x = 540 - 30 + (i - (s.bitTimes.length - 1) / 2) * 76
        const tx = lerp(510, x, ease.out(p))
        const ty = lerp(1000, 1290, ease.out(p))
        el.style.left = `${tx.toFixed(1)}px`
        el.style.top = `${ty.toFixed(1)}px`
        el.style.opacity = (clamp(p * 4) * (1 - yearsOn) * 0.85).toFixed(3)
      })

      // “九十年”: the years spin by under the switch.
      const yp = ease.inOut(prog(lt, c.W(3, '九十年'), 1.3))
      s.years.textContent = String(Math.round(lerp(1936, 2026, yp)))
      s.years.style.opacity = (yearsOn * (1 - prog(lt, c.E(3) + 0.2, 0.3))).toFixed(3)
      sfx('spin', c.W(3, '九十年'))

      // The switch speaks.
      const say = c.W(3, '和你说话')
      pop(s.bubble, lt, say, { dur: 0.4, from: 0.3 })
      typeText(s.bubbleText, '你好。', lt, say + 0.15, 7, '▌')
      sfx('pop', say)

      // Title card: switch and bubble lift away, title rises in.
      const tIn = c.E(3) + 0.35
      const out = ease.inOut(prog(lt, tIn - 0.1, 0.8))
      s.swWrap.style.transform = `translate3d(0, ${(-260 * out).toFixed(1)}px, 0) scale(${lerp(1, 0.9, out).toFixed(3)})`
      s.swWrap.style.opacity = (1 - out).toFixed(3)
      s.glow.style.opacity = ((+s.glow.style.opacity || 0) * (1 - out * 0.6)).toFixed(3)
      rise(s.title, lt, tIn + 0.2, { dur: 0.9, dist: 60 })
      sfx('title', tIn + 0.2)
      s.titleMain.style.letterSpacing = `${lerp(0.2, 0.04, ease.out(prog(lt, tIn + 0.2, 1.6))).toFixed(3)}em`
    },
  },

  // ================================================================ 1936 纸带
  turing: {
    wipe: '#efe7d4',
    year: (lt, c) => (lt < c.W(3, '十四年后') ? 1936 : 1950),
    build(root, c) {
      const s = {}
      put(root, 'fill', '', {
        background: 'var(--paper)',
        backgroundImage:
          'linear-gradient(rgba(64,104,160,0.12) 2px, transparent 2px), linear-gradient(90deg, rgba(64,104,160,0.12) 2px, transparent 2px)',
        backgroundSize: '45px 45px',
        backgroundPosition: '-6px 18px',
      })
      put(root, 'fill', '', { backgroundImage: PAPER_NOISE, opacity: '0.55', mixBlendMode: 'multiply' })
      put(root, 'fill', '', {
        background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(80,60,30,0.22) 100%)',
      })

      s.board = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      const g = 'var(--graphite)'

      // Heading, “written” in pencil.
      s.head1 = put(s.board, 'abs', '', {
        left: 96,
        top: 330,
        fontFamily: 'var(--hand)',
        fontSize: 40,
        color: g,
        opacity: '0.8',
      })
      s.head2 = put(s.board, 'abs', '', {
        left: 96,
        top: 390,
        fontFamily: 'var(--hand)',
        fontWeight: '700',
        fontSize: 76,
        color: g,
      })
      s.head3 = put(s.board, 'abs', '', {
        left: 100,
        top: 494,
        fontFamily: 'var(--type)',
        fontSize: 32,
        color: g,
        opacity: '0.7',
        fontStyle: 'italic',
      })

      // The tape: a vertical strip of cells that slides under a fixed head.
      s.tapeClip = put(s.board, 'abs', '', {
        left: 150,
        top: 600,
        width: 220,
        height: 800,
        overflow: 'hidden',
        maskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
        WebkitMaskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
      })
      s.tape = put(s.tapeClip, 'abs', '', { left: 20, top: 0, width: 180, height: 1 })
      s.cells = []
      s.CELL = 150
      for (let i = -6; i <= 10; i++) {
        const cell = put(
          s.tape,
          'abs center',
          '<span></span><span class="w"></span>',
          {
            left: 0,
            top: i * s.CELL,
            width: 180,
            height: s.CELL,
            borderTop: `3px solid ${'rgba(55,53,47,0.85)'}`,
            borderLeft: '3px solid rgba(55,53,47,0.85)',
            borderRight: '3px solid rgba(55,53,47,0.85)',
            fontFamily: 'var(--hand)',
            fontWeight: '700',
            fontSize: 96,
            color: g,
          },
        )
        cell.dataset.i = i
        s.cells.push(cell)
      }
      s.inf = [
        put(s.board, 'abs center', '∞', { left: 150, top: 520, width: 220, height: 80, fontSize: 80, fontFamily: 'var(--hand)', color: g }),
        put(s.board, 'abs center', '∞', { left: 150, top: 1400, width: 220, height: 80, fontSize: 80, fontFamily: 'var(--hand)', color: g }),
      ]

      // Read/write head (fixed) with a pencil arrow.
      s.head = put(
        s.board,
        'abs',
        `<svg width="420" height="220" viewBox="0 0 420 220" filter="url(#pencil)">
          <defs>${PENCIL_FILTER}</defs>
          <path class="draw hb" d="M 10 30 L 210 30 L 210 190 L 10 190 Z" stroke="#37352f" stroke-width="7"/>
          <path class="draw ha" d="M 380 110 L 232 110 M 262 80 L 228 110 L 262 140" stroke="#37352f" stroke-width="6"/>
        </svg>`,
        { left: 155, top: 895 },
      )
      s.headBox = $('.hb', s.head)
      s.headArrow = $('.ha', s.head)
      s.headLabel = put(s.board, 'abs', '读写头', {
        left: 560,
        top: 975,
        fontFamily: 'var(--hand)',
        fontWeight: '700',
        fontSize: 48,
        color: g,
      })

      // Rule card: binary “+1” (move up from the lowest digit).
      s.rules = put(
        s.board,
        'abs',
        `<div style="font-family:var(--hand);font-weight:700;font-size:48px;margin-bottom:18px">规则</div>
         <div class="r" style="padding:12px 18px;margin:0 -18px">读到 <b>1</b> → 写 <b>0</b>，往上走</div>
         <div class="r" style="padding:12px 18px;margin:0 -18px">读到 <b>0</b> → 写 <b>1</b>，停</div>`,
        {
          left: 560,
          top: 610,
          width: 440,
          fontFamily: 'var(--hand)',
          fontSize: 40,
          lineHeight: '1.35',
          color: g,
        },
      )
      s.ruleRows = $$('.r', s.rules)
      s.count = put(s.board, 'abs', '', {
        left: 560,
        top: 1150,
        width: 460,
        fontFamily: 'var(--hand)',
        fontSize: 42,
        lineHeight: '1.4',
        color: g,
      })

      // The question (1950).
      s.q = put(
        root,
        'abs',
        `<div class="q1" style="font-family:var(--hand);font-weight:700;font-size:150px;line-height:1.25">机器，</div>
         <div class="q2" style="font-family:var(--hand);font-weight:700;font-size:150px;line-height:1.25">能思考吗？</div>
         <svg width="760" height="60" viewBox="0 0 760 60" style="margin-top:4px" filter="url(#pencil)"><path class="draw ul" d="M 10 36 C 180 18, 420 50, 740 22" stroke="#37352f" stroke-width="8"/></svg>
         <div class="by" style="margin-top:36px;font-family:var(--hand);font-size:44px;opacity:.75">— 图灵，《计算机器与智能》，1950</div>`,
        { left: 110, top: 560, width: 900, color: g },
      )
      s.q1 = $('.q1', s.q)
      s.q2 = $('.q2', s.q)
      s.qul = $('.ul', s.q)
      s.qby = $('.by', s.q)

      // Machine run: tape holds 01011 (= 11); the head starts on the last digit.
      s.start = [0, 1, 0, 1, 1]
      const t0 = c.W(2, '只要规则写对')
      s.steps = [t0 + 0.1, t0 + 1.15, t0 + 2.2]
      return s
    },
    render(s, lt, c) {
      typeText(s.head1, 'A. M. 图灵 · 剑桥', lt, 0.7, 14)
      typeText(s.head2, '《论可计算数》', lt, 1.3, 9)
      typeText(s.head3, 'On Computable Numbers, 1936', lt, 2.2, 22)
      for (const t of [0.7, 1.3, 2.2]) sfx('pencil', t, { dur: 0.9 })

      // Tape draws in on “纸带”, head on “读写头”, rules on “规则”.
      const tapeT = c.W(1, '纸带')
      const tp = ease.out(prog(lt, tapeT - 0.2, 0.9))
      s.tapeClip.style.clipPath = `inset(0 0 ${((1 - tp) * 100).toFixed(2)}% 0)`
      sfx('pencil', tapeT - 0.2, { dur: 0.9 })
      draw(s.headBox, lt, c.W(1, '读写头'), 0.6)
      draw(s.headArrow, lt, c.W(1, '读写头') + 0.3, 0.4)
      fade(s.headLabel, lt, c.W(1, '读写头') + 0.4, 0.3)
      rise(s.rules, lt, c.W(1, '规则') - 0.1, { dur: 0.6, dist: 20 })
      sfx('pencil', c.W(1, '读写头'), { dur: 0.6 })

      // Machine state at this moment.
      const tape = [...s.start]
      let pos = 4
      let active = -1
      let writing = -1
      let moveP = 0
      s.steps.forEach((t, k) => {
        sfx('tick', t + 0.3)
        if (lt < t) return
        const read = tape[pos]
        active = read === 1 ? 0 : 1
        if (lt >= t + 0.3) tape[pos] = read === 1 ? 0 : 1
        else writing = pos
        if (read === 1) {
          const m = ease.inOut(prog(lt, t + 0.5, 0.4))
          if (m >= 1) pos -= 1
          else moveP = m
        }
      })
      const halted = lt >= s.steps[2] + 0.3
      s.ruleRows.forEach((r, i) => {
        const on = i === active && lt < s.steps[2] + 1.6
        r.style.background = on ? 'rgba(55,53,47,0.12)' : 'transparent'
        r.style.outline = on ? '3px solid rgba(55,53,47,0.8)' : 'none'
      })
      s.cells.forEach((cell) => {
        const i = +cell.dataset.i
        const [a, w] = cell.children
        const v = i >= 0 && i < 5 ? String(tape[i]) : ''
        a.textContent = v
        a.style.opacity = i === writing ? '0.25' : '1'
        w.textContent = ''
      })
      // Head fixed at cell centre y = 895 + 110 → tape offset keeps cell `pos` there.
      const offset = 1005 - 600 - (pos - moveP + 0.5) * s.CELL
      s.tape.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
      const val = parseInt(tape.join(''), 2)
      const running = lt >= s.steps[0] && !halted
      s.count.innerHTML = `纸带上：<b>${tape.join('')}</b><br>${running ? '计算中……' : `= ${val}`}${halted ? '<span style="opacity:.7">（11 + 1，算完了）</span>' : ''}`
      fade(s.count, lt, s.steps[0] - 0.3, 0.3)

      // “一切可以计算的事”: the tape is endless.
      const infT = c.W(2, '一切')
      s.inf.forEach((el) => pop(el, lt, infT, { dur: 0.5 }))

      // Fourteen years later: the machine fades to a sketch; the question is written.
      const dim = ease.inOut(prog(lt, c.L(3), 0.8))
      s.board.style.opacity = (1 - 0.88 * dim).toFixed(3)
      s.board.style.filter = dim > 0 ? `blur(${(dim * 3).toFixed(2)}px)` : ''
      const q = c.L(4)
      const w1 = ease.out(prog(lt, q - 0.1, 0.5))
      const w2 = ease.out(prog(lt, c.W(4, '能思考'), 0.8))
      s.q1.style.clipPath = `inset(-20% ${((1 - w1) * 100).toFixed(2)}% -20% 0)`
      s.q2.style.clipPath = `inset(-20% ${((1 - w2) * 100).toFixed(2)}% -20% 0)`
      s.q.style.visibility = lt >= q - 0.2 ? 'inherit' : 'hidden'
      draw(s.qul, lt, c.W(4, '吗') + 0.2, 0.5)
      fade(s.qby, lt, c.W(4, '吗') + 0.4, 0.5)
      sfx('pencil', q - 0.1, { dur: 1.6 })
    },
  },

  // ================================================================ 1946 电子管
  eniac: {
    wipe: '#ffb45a',
    year: (lt, c) => (lt < c.L(4) ? 1946 : 1947),
    build(root, c) {
      const s = {}
      root.style.background = '#0c0a08'
      s.weave = put(root, 'abs', '', { left: -20, top: -20, width: 1120, height: 1960 })
      const W = s.weave

      // Tube wall (canvas).
      s.cv = canvas(W, 1120, 1960)
      s.ctx = s.cv.getContext('2d')
      s.tubes = []
      const cols = 8
      const rows = 11
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < cols; k++)
          s.tubes.push({
            x: 90 + k * 128 + (r % 2) * 20,
            y: 110 + r * 172,
            seed: r * cols + k,
            row: r,
          })
      s.focus = s.tubes[5 * cols + 3]

      // Opening intertitle.
      s.card = put(
        W,
        'abs center',
        `<div style="text-align:center">
          <div style="font-family:var(--serif);font-size:34px;letter-spacing:0.5em;opacity:.8">宾夕法尼亚大学 · 1946</div>
          <div style="margin:26px 0 18px;font-family:var(--type);font-weight:700;font-size:210px;letter-spacing:0.08em;line-height:1">ENIAC</div>
          <div style="font-family:var(--serif);font-size:40px;letter-spacing:0.18em">电子数字积分计算机</div>
        </div>`,
        {
          left: 110,
          top: 560,
          width: 900,
          height: 620,
          color: 'var(--film)',
          background: 'rgba(12,10,8,0.9)',
          border: '4px double var(--film)',
          outline: '2px solid rgba(233,223,201,0.5)',
          outlineOffset: '14px',
        },
      )

      // Stats over the tube wall.
      s.stats = put(
        W,
        'abs',
        `<div class="st"><b class="n1">0</b><span>根电子管</span></div>
         <div class="st"><b>30</b><span>吨</span></div>
         <div class="st"><b>167</b><span>平方米</span></div>`,
        {
          left: 100,
          top: 1040,
          width: 920,
          padding: '28px 40px',
          background: 'rgba(12,10,8,0.86)',
          border: '3px double var(--film)',
          color: 'var(--film)',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--serif)',
        },
      )
      $$('.st', s.stats).forEach((el) => {
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px'
        el.firstElementChild.style.cssText = 'font-family:var(--type);font-size:84px;line-height:1'
        el.lastElementChild.style.cssText = 'font-size:32px;letter-spacing:.1em'
      })
      s.statEls = $$('.st', s.stats)
      s.n1 = $('.n1', s.stats)

      s.bitLabel = put(W, 'abs center', '', {
        left: 640,
        top: 700,
        width: 300,
        height: 300,
        fontFamily: 'var(--type)',
        fontWeight: '700',
        fontSize: 220,
        color: 'var(--film)',
      })

      // Plugboard with patch cables.
      s.panel = put(W, 'abs', '', { left: 20, top: 20, width: 1080, height: 1920, background: '#15120e' })
      let jacks = ''
      for (let r = 0; r < 9; r++)
        for (let k = 0; k < 8; k++)
          jacks += `<circle cx="${150 + k * 112}" cy="${400 + r * 76}" r="17" fill="#050403" stroke="#6d6454" stroke-width="4"/>`
      const J = (k, r) => [150 + k * 112, 400 + r * 76]
      const cables = [
        [J(0, 0), J(3, 4), '#d8ccb1'],
        [J(1, 1), J(6, 2), '#9d927c'],
        [J(2, 6), J(7, 1), '#e9dfc9'],
        [J(4, 0), J(1, 7), '#7b715f'],
        [J(5, 5), J(2, 3), '#c5b89c'],
        [J(6, 8), J(0, 4), '#aea38c'],
        [J(7, 6), J(4, 8), '#e0d4ba'],
        [J(3, 2), J(5, 7), '#8f846f'],
      ]
      const paths = cables
        .map(([[x1, y1], [x2, y2], col]) => {
          const sag = 140 + Math.abs(x2 - x1) * 0.25
          return `<path class="draw cab" d="M ${x1} ${y1} C ${x1} ${y1 + sag}, ${x2} ${y2 + sag}, ${x2} ${y2}" stroke="#000" stroke-width="18" opacity=".6"/><path class="draw cab" d="M ${x1} ${y1} C ${x1} ${y1 + sag}, ${x2} ${y2 + sag}, ${x2} ${y2}" stroke="${col}" stroke-width="11"/>`
        })
        .join('')
      s.panelSvg = put(
        s.panel,
        'abs',
        `<svg width="1080" height="1200" viewBox="0 0 1080 1200">
          <rect x="90" y="340" width="900" height="720" fill="#1f1a14" stroke="#4d4538" stroke-width="4"/>
          ${jacks}${paths}
        </svg>`,
        { left: 0, top: 0 },
      )
      s.cables = $$('.cab', s.panelSvg)
      s.names = put(
        s.panel,
        'abs',
        `<div style="font-family:var(--serif);font-weight:700;font-size:40px;margin-bottom:18px;letter-spacing:.1em">ENIAC 的第一批程序员</div>
         <div class="nm"></div>`,
        {
          left: 110,
          top: 1110,
          width: 880,
          padding: '30px 40px',
          color: '#1c1813',
          background: '#e6dcc5',
          fontFamily: 'var(--type)',
          fontSize: 34,
          lineHeight: '1.5',
          transform: 'rotate(-1deg)',
        },
      )
      s.nm = $('.nm', s.names)
      s.nameText =
        'Kay McNulty · Betty Jennings\nBetty Snyder · Marlyn Wescoff\nFran Bilas · Ruth Lichterman'

      // Logbook page, 9 September 1947.
      s.log = put(
        W,
        'abs',
        `<div style="font-family:var(--type);font-size:30px;opacity:.7;margin-bottom:20px">Harvard Mark II · 工作日志 · 1947.9.9</div>
         <div class="ln">1100&nbsp;&nbsp;Started Cosine Tape (Sine check)</div>
         <div class="ln">1525&nbsp;&nbsp;Started Mult+ Adder Test.</div>
         <div class="ln">1545&nbsp;&nbsp;Relay #70 Panel F (moth) in relay.</div>
         <div style="position:relative;height:330px">
           <svg class="moth" width="360" height="300" viewBox="-180 -150 360 300" style="position:absolute;left:250px;top:10px">
             <g fill="#3b2f22" stroke="#231a11" stroke-width="2">
               <path d="M -8 -20 C -90 -120, -170 -60, -150 -10 C -130 20, -60 10, -8 0 Z" opacity=".85"/>
               <path d="M 8 -20 C 90 -120, 170 -60, 150 -10 C 130 20, 60 10, 8 0 Z" opacity=".85"/>
               <path d="M -8 4 C -70 20, -120 90, -80 110 C -50 120, -20 60, -6 20 Z" opacity=".8"/>
               <path d="M 8 4 C 70 20, 120 90, 80 110 C 50 120, 20 60, 6 20 Z" opacity=".8"/>
               <ellipse cx="0" cy="10" rx="10" ry="52"/>
               <path d="M -4 -40 C -20 -80, -40 -95, -55 -100 M 4 -40 C 20 -80, 40 -95, 55 -100" fill="none" stroke-width="3"/>
             </g>
             <g stroke="#6b5840" stroke-width="1.5" fill="none" opacity=".7">
               <path d="M -20 -15 L -130 -40 M -20 -10 L -110 -5 M 20 -15 L 130 -40 M 20 -10 L 110 -5"/>
             </g>
           </svg>
           <div style="position:absolute;left:230px;top:40px;width:130px;height:46px;background:rgba(240,235,215,.55);transform:rotate(-24deg);border:1px solid rgba(0,0,0,.08)"></div>
           <div style="position:absolute;left:470px;top:210px;width:130px;height:46px;background:rgba(240,235,215,.55);transform:rotate(-24deg);border:1px solid rgba(0,0,0,.08)"></div>
           <svg width="420" height="340" viewBox="0 0 420 340" style="position:absolute;left:220px;top:-10px"><path class="draw ring" d="M 210 20 C 330 20, 400 100, 395 180 C 390 270, 300 325, 200 320 C 90 315, 20 250, 25 165 C 30 80, 110 25, 225 30" stroke="#b8322a" stroke-width="7"/></svg>
         </div>
         <div class="ln big">First actual case of bug being found.</div>`,
        {
          left: 70,
          top: 360,
          width: 940,
          padding: '44px 50px 50px',
          color: '#221c14',
          background: '#ece3cc',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          fontFamily: 'var(--hand)',
          fontSize: 40,
          lineHeight: '1.75',
          backgroundImage: 'repeating-linear-gradient(transparent 0 69px, rgba(60,90,140,.25) 69px 71px)',
          transform: 'rotate(-1.5deg)',
        },
      )
      s.lines = $$('.ln', s.log)
      $('.big', s.log).style.cssText = 'font-size:46px;font-weight:700;margin-top:10px'
      s.moth = $('.moth', s.log)
      s.ring = $('.ring', s.log)

      // Film: grain, flicker, scratches, vignette.
      s.flicker = put(root, 'fill', '', { background: '#000', opacity: '0', zIndex: 7 })
      s.scratch = put(root, 'fill', '', { zIndex: 8 })
      s.scr = [0, 1, 2].map(() =>
        put(s.scratch, 'abs', '', { top: 0, width: 2, height: 1920, background: 'rgba(233,223,201,0.35)' }),
      )
      s.grain = grainLayer(root, 0.16)
      put(root, 'fill', '', {
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)',
        zIndex: 9,
      })
      return s
    },
    render(s, lt, c) {
      const f = Math.floor(lt * 18) // 18 fps gate weave
      s.weave.style.transform = `translate3d(${((hash(f, 5) - 0.5) * 4).toFixed(1)}px, ${((hash(f, 6) - 0.5) * 5).toFixed(1)}px, 0)`
      s.grain.tick(lt, 24)
      s.flicker.style.opacity = (0.04 + 0.1 * noise1(lt * 9, 3)).toFixed(3)
      s.scr.forEach((el, i) => {
        const on = hash(f, i, 9) > 0.55
        el.style.opacity = on ? '1' : '0'
        el.style.left = `${Math.floor(hash(f, i, 4) * 1080)}px`
      })

      // --- tube wall
      const ctx = s.ctx
      ctx.clearRect(0, 0, 1120, 1960)
      const wallIn = prog(lt, 0.2, 0.01)
      const cardOut = ease.inOut(prog(lt, c.L(1) - 0.1, 0.5))
      const light = c.L(1)
      const zoomT = c.L(2)
      const zoom = ease.inOut(prog(lt, zoomT - 0.2, 1.2))
      const unzoom = ease.inOut(prog(lt, c.L(3) - 0.3, 0.6))
      const z = lerp(1, 3.4, zoom * (1 - unzoom))
      const fx = s.focus.x + 50
      const fy = s.focus.y + 70
      const cx = lerp(560, 780, zoom * (1 - unzoom))
      const cy = lerp(980, 860, zoom * (1 - unzoom))
      const onOff = flips(lt, {
        initial: 1,
        list: [
          [c.W(2, '都是') - 0.1, 0],
          [c.W(2, '都是') + 0.45, 1],
          [c.W(2, '开关') + 0.1, 0],
          [c.W(2, '开关') + 0.55, 1],
        ],
      })
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(z, z)
      ctx.translate(-fx, -fy)
      for (const tb of s.tubes) {
        const wave = prog(lt, light + tb.row * 0.12 + hash(tb.seed) * 0.4, 0.35)
        let g = wave * (0.75 + 0.25 * noise1(lt * 6 + tb.seed, tb.seed))
        // Now and then one burns out.
        if (hash(tb.seed, 77) > 0.93 && lt > light + 2) g *= Math.floor(lt * 3 + tb.seed) % 5 === 0 ? 0.1 : 1
        if (tb === s.focus && lt >= zoomT - 0.2 && lt < c.L(3)) g = wave * lerp(0.05, 1, onOff.x)
        drawTube(ctx, tb.x, tb.y, g, wallIn)
      }
      ctx.restore()
      for (let r = 0; r < 11; r++) sfx('hum', light + r * 0.12)

      s.card.style.opacity = (fade(s.card, lt, 0.25, 0.3) * (1 - cardOut)).toFixed(3)
      sfx('projector', 0.25)

      // Counters.
      const statOut = prog(lt, zoomT - 0.3, 0.3)
      s.statEls.forEach((el, i) => {
        const at = [c.W(1, '一万'), c.W(1, '三十吨'), c.W(1, '占满')][i]
        rise(el, lt, at - 0.1, { dur: 0.5, dist: 20 })
        sfx('thunk', at - 0.1)
      })
      const n = ease.out(prog(lt, c.W(1, '一万') - 0.1, 1.4))
      s.n1.textContent = groupDigits(17468 * n)
      s.stats.style.opacity = (fade(s.stats, lt, c.W(1, '一万') - 0.2, 0.2) * (1 - statOut)).toFixed(3)

      s.bitLabel.textContent = onOff.v ? '1' : '0'
      s.bitLabel.style.opacity = (prog(lt, zoomT + 0.5, 0.3) * (1 - prog(lt, c.L(3) - 0.3, 0.3))).toFixed(3)
      ;[c.W(2, '都是') - 0.1, c.W(2, '都是') + 0.45, c.W(2, '开关') + 0.1, c.W(2, '开关') + 0.55].forEach((t) => sfx('relay', t))

      // --- plugboard
      const pIn = c.L(3) - 0.2
      const pOut = c.L(4) - 0.3
      s.panel.style.visibility = lt >= pIn && lt < pOut + 0.4 ? 'inherit' : 'hidden'
      s.panel.style.opacity = (prog(lt, pIn, 0.3) * (1 - prog(lt, pOut, 0.3))).toFixed(3)
      for (let i = 0; i < s.cables.length; i += 2) {
        const at = c.W(3, '插拔') - 1.2 + (i / 2) * 0.28
        draw(s.cables[i], lt, at, 0.45)
        draw(s.cables[i + 1], lt, at, 0.45)
        sfx('plug', at + 0.4)
      }
      rise(s.names, lt, c.W(3, '六位') - 0.2, { dur: 0.5, base: 'rotate(-1deg)' })
      typeText(s.nm, s.nameText, lt, c.W(3, '六位'), 26)
      s.nm.style.whiteSpace = 'pre-line'
      sfx('typewriter', c.W(3, '六位'), { dur: 3 })

      // --- logbook
      const lIn = c.L(4) - 0.1
      const drop = ease.out(prog(lt, lIn, 0.6))
      s.log.style.visibility = lt >= lIn ? 'inherit' : 'hidden'
      s.log.style.opacity = clamp(drop * 2).toFixed(3)
      s.log.style.transform = `translate3d(0, ${((1 - drop) * 80).toFixed(1)}px, 0) rotate(${lerp(-5, -1.5, drop).toFixed(2)}deg)`
      sfx('paper', lIn)
      s.lines.forEach((ln, i) => {
        const at = i < 3 ? lIn + 0.5 + i * 0.55 : c.W(5, '第一只') - 0.2
        const p = ease.out(prog(lt, at, i < 3 ? 0.5 : 0.9))
        ln.style.clipPath = `inset(-20% ${((1 - p) * 100).toFixed(2)}% -20% 0)`
      })
      const mp = ease.out(prog(lt, c.W(4, '飞蛾') - 0.1, 0.5))
      s.moth.style.opacity = mp.toFixed(3)
      s.moth.style.transform = `scale(${lerp(1.4, 1, mp).toFixed(3)}) rotate(${lerp(-18, 8, mp).toFixed(2)}deg)`
      draw(s.ring, lt, c.W(5, 'bug') - 0.1, 0.5)
      sfx('pencil', c.W(5, 'bug') - 0.1, { dur: 0.5 })
    },
  },

  // ================================================================ 1947–1971 晶体管 → 芯片
  chip: {
    wipe: '#d4e8ff',
    year: (lt, c) => {
      if (lt < c.W(2, '硅片')) return 1947
      if (lt < c.W(3, '摩尔')) return 1958
      if (lt < c.L(4)) return 1965
      return 1971
    },
    build(root, c) {
      const s = {}
      put(root, 'fill', '', {
        background: 'var(--blue)',
        backgroundImage:
          'linear-gradient(rgba(212,232,255,0.13) 2px, transparent 2px), linear-gradient(90deg, rgba(212,232,255,0.13) 2px, transparent 2px), linear-gradient(rgba(212,232,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(212,232,255,0.06) 1px, transparent 1px)',
        backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
      })
      put(root, 'fill', '', {
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.06), rgba(0,0,0,0.35) 100%)',
      })
      const L = '#d4e8ff'
      const label = (html, box) =>
        put(root, 'abs', html, { fontFamily: 'var(--mono)', fontSize: 30, color: L, letterSpacing: '0.04em', ...box })

      // --- A: tube → transistor
      s.a = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.aSvg = put(
        s.a,
        'abs',
        `<svg width="1080" height="1100" viewBox="0 0 1080 1100" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path class="d" d="M 170 860 L 170 560 C 170 450, 230 400, 270 400 C 310 400, 370 450, 370 560 L 370 860 Z"/>
          <path class="d" d="M 150 860 L 390 860 L 390 950 L 150 950 Z"/>
          <path class="d" d="M 200 950 L 200 1000 M 245 950 L 245 1000 M 295 950 L 295 1000 M 340 950 L 340 1000"/>
          <path class="d" d="M 215 560 L 325 560 L 325 800 L 215 800 Z"/>
          <path class="d" d="M 240 590 L 300 610 L 240 630 L 300 650 L 240 670 L 300 690 L 240 710 L 300 730 L 240 750"/>
          <path class="d" d="M 270 800 L 270 860"/>
          <path class="d" d="M 100 400 L 100 1000 M 85 400 L 115 400 M 85 1000 L 115 1000" stroke-width="2" opacity=".7"/>
          <path class="d" d="M 470 700 L 610 700 M 580 670 L 612 700 L 580 730" stroke-width="6"/>
          <path class="d" d="M 730 700 L 730 640 C 730 610, 750 600, 800 600 C 850 600, 870 610, 870 640 L 870 700 Z"/>
          <path class="d" d="M 715 700 L 885 700 L 885 720 L 715 720 Z"/>
          <path class="d" d="M 760 720 L 760 830 M 800 720 L 800 830 M 840 720 L 840 830"/>
          <path class="d" d="M 950 600 L 950 830 M 935 600 L 965 600 M 935 830 L 965 830" stroke-width="2" opacity=".7"/>
        </svg>`,
        { left: 0, top: 0 },
      )
      s.aPaths = $$('.d', s.aSvg)
      s.aLbl = [
        label('电子管', { left: 190, top: 1030, fontSize: 40, fontFamily: 'var(--sans)', fontWeight: '700' }),
        label('晶体管', { left: 740, top: 1030, fontSize: 40, fontFamily: 'var(--sans)', fontWeight: '700' }),
        label('贝尔实验室 · 1947.12', { left: 640, top: 520, fontSize: 28 }),
        label('FIG. 1', { left: 96, top: 330, fontSize: 28, opacity: '0.7' }),
      ]
      s.aLbl.forEach((el) => s.a.appendChild(el))
      s.specs = put(s.a, 'abs', '', { left: 96, top: 1110, width: 888 })
      s.specRows = [
        ['体积', 1, 0.1, '更小'],
        ['速度', 0.18, 1, '更快'],
        ['寿命', 0.2, 1, '更耐用'],
      ].map(([name, a, b, tag]) => {
        const row = put(
          s.specs,
          '',
          `<div style="width:110px;font-family:var(--sans);font-weight:700;font-size:36px">${name}</div>
           <div style="flex:1;display:flex;flex-direction:column;gap:8px">
             <i class="ba" style="display:block;height:14px;background:rgba(212,232,255,.35);transform-origin:left"></i>
             <i class="bb" style="display:block;height:14px;background:#fff;transform-origin:left"></i>
           </div>
           <div style="width:170px;text-align:right;font-family:var(--sans);font-weight:700;font-size:36px">${tag}</div>`,
          { position: 'relative', display: 'flex', alignItems: 'center', gap: '24px', height: 76, color: L },
        )
        row.a = a
        row.b = b
        return row
      })
      s.legend = label('<span style="opacity:.5">▬</span> 电子管　<span>▬</span> 晶体管　（示意）', {
        left: 96,
        top: 1360,
        fontSize: 24,
        fontFamily: 'var(--sans)',
      })
      s.a.appendChild(s.legend)

      // --- B: transistors fly into a die → chip
      s.b = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.flyers = []
      const r = rng(1958)
      for (let i = 0; i < 64; i++) {
        const el = put(
          s.b,
          'abs',
          `<svg width="54" height="54" viewBox="-27 -27 54 54" stroke="${L}" stroke-width="3" fill="none"><circle r="18"/><path d="M -24 0 L -6 0 M -6 -10 L -6 10 M -6 -4 L 12 -16 L 12 -26 M -6 4 L 12 16 L 12 26"/></svg>`,
          { left: 0, top: 0 },
        )
        el.from = [60 + r() * 960, 340 + r() * 1040]
        el.to = [376 + (i % 8) * 41, 596 + Math.floor(i / 8) * 41]
        el.delay = r() * 0.8
        s.flyers.push(el)
      }
      let pins = ''
      for (let i = 0; i < 8; i++) {
        const y = 560 + i * 50
        pins += `<path d="M 300 ${y} L 250 ${y} M 780 ${y} L 830 ${y}"/>`
      }
      s.chipSvg = put(
        s.b,
        'abs',
        `<svg width="1080" height="1100" viewBox="0 0 1080 1100" stroke="${L}" stroke-width="4" fill="none">
          <rect class="pk" x="300" y="520" width="480" height="420" rx="10" fill="rgba(10,30,70,.6)"/>
          <path class="pk" d="M 520 520 A 20 20 0 0 0 560 520"/>
          <g class="pn">${pins}</g>
          <rect class="die" x="360" y="580" width="360" height="340" fill="rgba(212,232,255,.06)"/>
        </svg>`,
        { left: 0, top: 0 },
      )
      s.pk = $$('.pk, .pn', s.chipSvg)
      s.die = $('.die', s.chipSvg)
      s.chipLbl = label('<b style="font-family:var(--sans);font-size:44px">芯片</b><br>集成电路 · 1958', {
        left: 300,
        top: 1000,
        lineHeight: '1.5',
      })
      s.b.appendChild(s.chipLbl)

      // --- C: Moore's law
      s.cc = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      const X0 = 150
      const X1 = 990
      const Y0 = 1060
      const Y1 = 400
      const xOf = (y) => X0 + ((y - 1970) / (2026 - 1970)) * (X1 - X0)
      const yOf = (n) => Y0 - ((Math.log10(n) - 3) / 9) * (Y0 - Y1)
      s.pts = [
        [1971, 2300, 'Intel 4004'],
        [1978, 29000],
        [1985, 275000],
        [1993, 3.1e6],
        [2000, 4.2e7],
        [2006, 2.91e8],
        [2012, 1.4e9],
        [2016, 7.2e9],
        [2020, 5.4e10],
        [2022, 8e10],
        [2024, 2.08e11, 'AI 芯片'],
      ].map(([y, n, name]) => ({ y, n, name, x: xOf(y), py: yOf(n) }))
      let grid = ''
      for (let e = 3; e <= 12; e += 3) {
        const yy = yOf(10 ** e)
        grid += `<path d="M ${X0} ${yy} L ${X1} ${yy}" stroke-dasharray="6 10" opacity=".35"/><text x="${X0 - 18}" y="${yy + 10}" text-anchor="end" fill="${L}" stroke="none" font-size="28" font-family="JetBrains Mono">10${['³', '⁶', '⁹', '¹²'][e / 3 - 1]}</text>`
      }
      for (const yr of [1970, 1990, 2010]) {
        const xx = xOf(yr)
        grid += `<text x="${xx}" y="${Y0 + 50}" text-anchor="middle" fill="${L}" stroke="none" font-size="28" font-family="JetBrains Mono">${yr}</text>`
      }
      const line = s.pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')
      const dots = s.pts.map((p) => `<circle class="pt" cx="${p.x}" cy="${p.py}" r="9" fill="${L}" stroke="none"/>`).join('')
      s.chart = put(
        s.cc,
        'abs',
        `<svg width="1080" height="1200" viewBox="0 0 1080 1200" stroke="${L}" stroke-width="3" fill="none">
          <g class="gr">${grid}</g>
          <path class="ax" d="M ${X0} ${Y1 - 30} L ${X0} ${Y0} L ${X1 + 10} ${Y0}"/>
          <path class="ln" d="${line}" stroke="#fff" stroke-width="6"/>
          ${dots}
          <circle class="ring" cx="${s.pts[0].x}" cy="${s.pts[0].py}" r="26" stroke="#fff" stroke-width="4"/>
          <circle class="ring2" cx="${s.pts.at(-1).x}" cy="${s.pts.at(-1).py}" r="26" stroke="#fff" stroke-width="4"/>
        </svg>`,
        { left: 0, top: 0 },
      )
      s.chartGrid = $('.gr', s.chart)
      s.chartAx = $('.ax', s.chart)
      s.chartLn = $('.ln', s.chart)
      s.chartPts = $$('.pt', s.chart)
      s.ring = $('.ring', s.chart)
      s.ring2 = $('.ring2', s.chart)
      s.chartTitle = label('<b style="font-family:var(--sans);font-size:42px">摩尔定律</b>　每块芯片上的晶体管数', {
        left: 96,
        top: 320,
      })
      s.cc.appendChild(s.chartTitle)
      s.x2 = label('≈ 每两年 ×2', { left: 560, top: 820, fontSize: 40, fontFamily: 'var(--sans)', fontWeight: '700', color: '#fff', transform: 'rotate(-38deg)' })
      s.cc.appendChild(s.x2)
      s.counter = put(
        s.cc,
        'abs',
        `<div class="cap" style="font-family:var(--sans);font-size:34px;font-weight:700;opacity:.85"></div>
         <div class="num" style="font-family:var(--mono);font-weight:700;font-size:88px;line-height:1.2;color:#fff;white-space:nowrap"></div>`,
        { left: 96, top: 1150, width: 900, color: L },
      )
      s.cap = $('.cap', s.counter)
      s.num = $('.num', s.counter)
      return s
    },
    render(s, lt, c) {
      // A
      const aOut = ease.inOut(prog(lt, c.L(2) - 0.2, 0.5))
      s.a.style.opacity = (1 - aOut).toFixed(3)
      s.a.style.visibility = aOut >= 1 ? 'hidden' : 'inherit'
      s.aPaths.forEach((p, i) => {
        const at = i < 7 ? 0.4 + i * 0.12 : c.W(0, '晶体管') - 0.3 + (i - 7) * 0.14
        draw(p, lt, at, 0.6)
      })
      sfx('draft', 0.4, { dur: 1.2 })
      sfx('draft', c.W(0, '晶体管') - 0.3, { dur: 0.8 })
      fade(s.aLbl[0], lt, 1.1, 0.4)
      fade(s.aLbl[1], lt, c.W(0, '晶体管'), 0.4)
      fade(s.aLbl[2], lt, c.W(0, '贝尔'), 0.4)
      fade(s.aLbl[3], lt, 0.3, 0.4)
      s.specRows.forEach((row, i) => {
        const at = [c.W(1, '更小'), c.W(1, '更快'), c.W(1, '不容易坏')][i] - 0.15
        rise(row, lt, at, { dur: 0.45, dist: 16 })
        const p = ease.out(prog(lt, at + 0.1, 0.6))
        $('.ba', row).style.transform = `scaleX(${(row.a * p).toFixed(4)})`
        $('.bb', row).style.transform = `scaleX(${(row.b * p).toFixed(4)})`
        sfx('tick', at)
      })
      fade(s.legend, lt, c.W(1, '更小'), 0.4)

      // B
      const bIn = c.L(2) - 0.1
      const bOut = ease.inOut(prog(lt, c.L(3) - 0.2, 0.5))
      s.b.style.visibility = lt >= bIn && bOut < 1 ? 'inherit' : 'hidden'
      s.b.style.opacity = (1 - bOut).toFixed(3)
      const fly = c.W(2, '刻进')
      s.flyers.forEach((el, i) => {
        const appear = prog(lt, bIn + (i % 16) * 0.03, 0.3)
        const p = ease.inOut(prog(lt, fly - 0.3 + el.delay, 0.9))
        const x = lerp(el.from[0], el.to[0], p) - 27
        const y = lerp(el.from[1], el.to[1], p) - 27
        const sc = lerp(1, 0.62, p)
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`
        el.style.opacity = appear.toFixed(3)
      })
      sfx('swarm', fly - 0.3, { dur: 1.4 })
      s.pk.forEach((p, i) => (p.style.opacity = prog(lt, c.W(2, '芯片') - 0.5 + i * 0.1, 0.4).toFixed(3)))
      s.die.style.opacity = prog(lt, fly + 0.5, 0.4).toFixed(3)
      fade(s.chipLbl, lt, c.W(2, '芯片') - 0.2, 0.4)
      sfx('thunk', c.W(2, '芯片') - 0.2)

      // C
      const cIn = c.L(3) - 0.1
      s.cc.style.visibility = lt >= cIn ? 'inherit' : 'hidden'
      fade(s.chartTitle, lt, cIn, 0.4)
      s.chartGrid.style.opacity = prog(lt, cIn + 0.2, 0.5).toFixed(3)
      draw(s.chartAx, lt, cIn, 0.7)
      // Line draws to 1971 early, then races to 2024 on the last line.
      if (s.chartLn.__len === undefined) s.chartLn.__len = s.chartLn.getTotalLength()
      const lenAll = s.chartLn.__len
      const p1 = ease.inOut(prog(lt, c.W(3, '晶体管') - 0.2, 2.6)) * 0.72
      const p2 = ease.inOut(prog(lt, c.W(5, 'AI') - 0.3, 1.8)) * 0.28
      const drawn = p1 + p2
      s.chartLn.style.strokeDasharray = `${lenAll} ${lenAll + 4}`
      s.chartLn.style.strokeDashoffset = (lenAll * (1 - drawn)).toFixed(2)
      s.chartLn.style.visibility = drawn > 0 ? 'inherit' : 'hidden'
      s.chartPts.forEach((pt, i) => {
        const at = i / (s.chartPts.length - 1)
        pt.style.opacity = drawn >= at - 0.01 ? '1' : '0'
      })
      sfx('rise', c.W(3, '晶体管') - 0.2, { dur: 2.6 })
      pop(s.x2, lt, c.W(3, '翻一番') - 0.1, { dur: 0.45, base: 'rotate(-38deg)' })
      sfx('pop', c.W(3, '翻一番') - 0.1)
      s.ring.style.opacity = (prog(lt, c.L(4), 0.3) * (1 - prog(lt, c.L(5), 0.3))).toFixed(3)
      s.ring2.style.opacity = prog(lt, c.W(5, '两千亿') - 0.1, 0.3).toFixed(3)

      // Counter: 2,300 → 208,000,000,000 (exponential roll).
      const k = ease.inOut(prog(lt, c.W(5, 'AI') - 0.3, 1.8))
      const n = 2300 * Math.pow(2.08e11 / 2300, k)
      s.counter.style.visibility = lt >= c.L(4) - 0.1 ? 'inherit' : 'hidden'
      fade(s.counter, lt, c.L(4) - 0.1, 0.3)
      s.cap.textContent = k > 0.02 ? (k < 1 ? '……' : '2024 · 顶级 AI 芯片（约 2080 亿）') : '1971 · Intel 4004'
      s.num.textContent = groupDigits(n)
      s.num.style.fontSize = `${lerp(120, 88, ease.out(k)).toFixed(1)}px`
      sfx('thunk', c.L(4) - 0.1)
      sfx('counter', c.W(5, 'AI') - 0.3, { dur: 1.8 })
    },
  },

  // ================================================================ 1969 磷光屏
  moon: {
    wipe: '#3dff72',
    build(root, c) {
      const s = {}
      const G = 'var(--phosphor)'
      root.style.background = '#020a04'
      s.crt = put(root, 'abs', '', {
        left: 0,
        top: 0,
        width: 1080,
        height: 1920,
        color: G,
        fontFamily: 'var(--code)',
        textShadow: '0 0 8px rgba(61,255,114,0.85), 0 0 24px rgba(61,255,114,0.4)',
      })
      const C = s.crt
      const glowSvg = 'filter:drop-shadow(0 0 6px rgba(61,255,114,.9)) drop-shadow(0 0 18px rgba(61,255,114,.4))'

      // --- A: descent
      s.a = put(C, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      let craters = ''
      const r = rng(69)
      for (let i = 0; i < 9; i++) {
        const x = 80 + r() * 920
        const y = 1210 + r() * 170
        const w = 30 + r() * 90
        craters += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${w.toFixed(0)}" ry="${(w * 0.22).toFixed(0)}"/>`
      }
      s.surface = put(
        s.a,
        'abs',
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" stroke="#3dff72" stroke-width="3" fill="none" style="${glowSvg}">
          <path class="hz" d="M 0 1190 C 200 1170, 420 1200, 600 1180 C 780 1162, 900 1186, 1080 1176"/>
          <g class="cr">${craters}</g>
          <circle class="earth" cx="880" cy="720" r="54"/>
          <path class="earth" d="M 846 700 C 866 690, 880 712, 900 700 M 850 740 C 870 730, 896 752, 914 738"/>
        </svg>`,
        { left: 0, top: 0 },
      )
      s.hz = $('.hz', s.surface)
      s.cr = $('.cr', s.surface)
      s.earth = $$('.earth', s.surface)
      s.lm = put(
        s.a,
        'abs',
        `<svg width="220" height="220" viewBox="-110 -110 220 220" stroke="#3dff72" stroke-width="4" fill="none" style="${glowSvg}">
          <path d="M -40 -70 L 40 -70 L 55 -40 L 40 -10 L -40 -10 L -55 -40 Z"/>
          <path d="M -60 -10 L 60 -10 L 60 30 L -60 30 Z"/>
          <path d="M -60 30 L -90 80 M 60 30 L 90 80 M -30 30 L -45 80 M 30 30 L 45 80 M -104 80 L -76 80 M 76 80 L 104 80"/>
          <path d="M -10 30 L -18 50 L 18 50 L 10 30"/>
          <path class="flame" d="M -14 54 L 0 100 L 14 54" stroke-width="3" stroke-dasharray="6 6"/>
        </svg>`,
        { left: 0, top: 0 },
      )
      s.flame = $('.flame', s.lm)
      s.dsky = put(
        s.a,
        'abs',
        `<div style="display:grid;grid-template-columns:auto auto;gap:10px 40px;font-size:40px">
           <span style="opacity:.6">PROG</span><b>63</b>
           <span style="opacity:.6">VERB</span><b>16</b>
           <span style="opacity:.6">NOUN</span><b>68</b>
           <span style="opacity:.6">ALT</span><b class="alt">+00000</b>
         </div>
         <div class="ram" style="margin-top:34px;padding-top:24px;border-top:2px solid rgba(61,255,114,.5);font-size:38px;line-height:1.5">
           <div style="opacity:.6;font-size:30px">阿波罗导航计算机 · 内存</div>
           <div style="display:flex;align-items:center;gap:22px"><b style="font-size:66px">≈ 4 KB</b><i class="sq" style="display:inline-block;width:37px;height:37px;background:#3dff72;box-shadow:0 0 16px #3dff72"></i></div>
         </div>`,
        { left: 96, top: 340, width: 520 },
      )
      s.alt = $('.alt', s.dsky)
      s.ram = $('.ram', s.dsky)

      // --- B: this frame vs 4 KB
      s.b = put(C, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.frameBox = put(
        s.b,
        'abs',
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" stroke="#3dff72" stroke-width="5" fill="none" style="${glowSvg}"><path class="fr" d="M 24 24 L 1056 24 L 1056 1896 L 24 1896 Z" stroke-dasharray="26 14"/></svg>`,
        { left: 0, top: 0 },
      )
      s.fr = $('.fr', s.frameBox)
      s.frameLbl = put(
        s.b,
        'abs center',
        `<div style="text-align:center;line-height:1.5">
          <div style="font-size:36px;opacity:.75">你眼前的这一帧画面</div>
          <div style="font-size:58px;font-weight:700">1080 × 1920 × 3 字节</div>
          <div style="font-size:92px;font-weight:700">≈ 6.2 MB</div>
        </div>`,
        { left: 0, top: 380, width: 1080, height: 400 },
      )
      s.tiny = put(s.b, 'abs', '', { left: 521, top: 900, width: 37, height: 37, background: '#3dff72', boxShadow: '0 0 20px #3dff72' })
      s.tinyLbl = put(
        s.b,
        'abs center',
        `<div style="text-align:center;line-height:1.5"><div style="font-size:48px;font-weight:700">↑ 4 KB</div><div style="font-size:34px;opacity:.75">不到千分之一</div></div>`,
        { left: 0, top: 960, width: 1080, height: 180 },
      )

      // --- C/D: ARPANET
      s.net = put(C, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      const term = (name, sub, top) =>
        put(
          s.net,
          'abs',
          `<div style="display:flex;justify-content:space-between;font-size:30px;opacity:.75"><span>${sub}</span><span>IMP</span></div>
           <div style="font-size:64px;font-weight:700;margin:6px 0 16px">${name}</div>
           <div class="scr" style="height:96px;font-size:72px;font-weight:700;letter-spacing:.1em"></div>`,
          { left: 150, top, width: 780, padding: '26px 36px', border: '3px solid #3dff72', boxShadow: '0 0 18px rgba(61,255,114,.5), inset 0 0 18px rgba(61,255,114,.25)' },
        )
      s.ucla = term('UCLA', '洛杉矶', 380)
      s.sri = term('SRI', '斯坦福研究所', 1010)
      s.uScr = $('.scr', s.ucla)
      s.sScr = $('.scr', s.sri)
      s.link = put(
        s.net,
        'abs',
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" stroke="#3dff72" stroke-width="4" fill="none" style="${glowSvg}"><path class="lk" d="M 540 680 L 540 1010" stroke-dasharray="14 12"/></svg>`,
        { left: 0, top: 0 },
      )
      s.lk = $('.lk', s.link)
      s.packets = [0, 1, 2].map(() => put(s.net, 'abs', '', { left: 528, top: 0, width: 24, height: 24, background: '#3dff72', boxShadow: '0 0 14px #3dff72' }))
      s.km = put(s.net, 'abs', '≈ 560 km', { left: 580, top: 810, fontSize: 38 })
      s.date = put(s.net, 'abs', '1969.10.29 · 22:30', { left: 150, top: 320, fontSize: 32, opacity: '0.75' })
      s.crash = put(s.net, 'abs center', 'SYSTEM CRASH', {
        left: 0,
        top: 880,
        width: 1080,
        height: 130,
        fontSize: 96,
        fontWeight: '700',
        color: '#020a04',
        background: '#3dff72',
        textShadow: 'none',
      })

      // --- E: LO
      s.lo = put(
        C,
        'abs center',
        `<div style="text-align:center">
          <div style="font-size:250px;font-weight:700;line-height:1;letter-spacing:.04em">LO<span class="gin" style="opacity:.16;text-decoration:line-through;text-decoration-thickness:10px">GIN</span></div>
          <div style="margin-top:50px;font-size:44px;opacity:.85;font-family:var(--sans)">互联网说出的第一句话</div>
        </div>`,
        { left: -200, top: 560, width: 1480, height: 700 },
      )

      // CRT: scanlines, rolling bar, curvature vignette.
      put(root, 'fill', '', {
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.38) 0 2px, transparent 2px 5px)',
        zIndex: 8,
      })
      s.roll = put(root, 'abs', '', {
        left: 0,
        top: 0,
        width: 1080,
        height: 260,
        background: 'linear-gradient(transparent, rgba(61,255,114,0.07), transparent)',
        zIndex: 8,
      })
      put(root, 'fill', '', {
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)',
        zIndex: 9,
      })
      return s
    },
    render(s, lt, c) {
      s.roll.style.transform = `translate3d(0, ${(((lt * 260) % 2180) - 260).toFixed(1)}px, 0)`
      s.crt.style.opacity = (0.94 + 0.06 * noise1(lt * 20, 8)).toFixed(3)

      // A: 0 → L2
      const aOut = prog(lt, c.L(2) - 0.25, 0.3)
      s.a.style.opacity = (1 - aOut).toFixed(3)
      s.a.style.visibility = aOut >= 1 ? 'hidden' : 'inherit'
      draw(s.hz, lt, 0.3, 1.0)
      s.cr.style.opacity = prog(lt, 0.8, 0.6).toFixed(3)
      s.earth.forEach((e) => (e.style.opacity = prog(lt, 1.2, 0.6).toFixed(3)))
      const d = ease.out(prog(lt, 0.3, c.L(2) - 0.8))
      s.lm.style.transform = `translate3d(${lerp(620, 430, d).toFixed(1)}px, ${lerp(380, 990, d).toFixed(1)}px, 0)`
      s.flame.style.opacity = d < 0.98 && Math.floor(lt * 15) % 2 ? '1' : '0.3'
      fade(s.dsky, lt, 0.6, 0.3)
      s.alt.textContent = `+${String(Math.round(lerp(7200, 0, d))).padStart(5, '0')}`
      s.ram.style.opacity = prog(lt, c.W(1, '内存') - 0.2, 0.3).toFixed(3)
      s.ram.style.visibility = lt >= c.W(1, '内存') - 0.2 ? 'inherit' : 'hidden'
      sfx('beeps', 0.6, { dur: 2 })

      // B
      const bIn = c.L(2) - 0.1
      const bOut = prog(lt, c.L(3) - 0.3, 0.3)
      s.b.style.visibility = lt >= bIn && bOut < 1 ? 'inherit' : 'hidden'
      s.b.style.opacity = (1 - bOut).toFixed(3)
      draw(s.fr, lt, bIn, 1.0, ease.inOut)
      fade(s.frameLbl, lt, c.W(2, '这一帧'), 0.4)
      const pulse = 1 + 0.25 * Math.max(0, Math.sin((lt - bIn) * 7))
      s.tiny.style.transform = `scale(${pulse.toFixed(3)})`
      fade(s.tiny, lt, bIn + 0.3, 0.2)
      fade(s.tinyLbl, lt, c.W(2, '千分之一') - 0.2, 0.3)
      sfx('beeps', bIn, { dur: 0.6 })

      // C/D
      const cIn = c.L(3) - 0.1
      const cOut = prog(lt, c.L(5) - 0.3, 0.25)
      s.net.style.visibility = lt >= cIn && cOut < 1 ? 'inherit' : 'hidden'
      s.net.style.opacity = (1 - cOut).toFixed(3)
      fade(s.date, lt, cIn, 0.3)
      rise(s.ucla, lt, cIn + 0.1, { dur: 0.4, dist: 20 })
      rise(s.sri, lt, cIn + 0.35, { dur: 0.4, dist: 20 })
      draw(s.lk, lt, c.W(3, '第一次') - 0.3, 0.5)
      fade(s.km, lt, c.W(3, '五百') - 0.1, 0.3)
      s.packets.forEach((pk, i) => {
        const t0 = c.W(3, '第一次') + i * 0.35
        const p = ((lt - t0) / 1.0) % 1.4
        const on = lt >= t0 && lt < c.W(4, '系统') && p < 1
        pk.style.opacity = on ? '1' : '0'
        pk.style.transform = `translate3d(0, ${lerp(700, 980, clamp(p)).toFixed(1)}px, 0)`
      })
      const tL = c.W(4, 'L 和')
      const tO = c.W(4, 'O 两')
      const tG = c.W(4, '两个字母') + 0.3
      const crashT = c.W(4, '系统')
      const typed = lt >= tG ? 'LOG' : lt >= tO ? 'LO' : lt >= tL ? 'L' : ''
      const cur = Math.floor(lt * 3) % 2 === 0 ? '▌' : ' '
      const crashed = lt >= crashT
      s.uScr.textContent = lt >= c.W(4, '本想') ? `> ${typed}${crashed ? '' : cur}` : ''
      s.sScr.textContent = crashed ? '' : typed.slice(0, lt >= tG ? 2 : typed.length)
      for (const t of [tL, tO, tG]) sfx('key', t)
      const cr = prog(lt, crashT, 0.12)
      s.crash.style.opacity = cr > 0 ? (Math.floor(lt * 12) % 3 === 0 ? '0.4' : '1') : '0'
      s.crash.style.transform = `translate3d(${((hash(Math.floor(lt * 24), 3) - 0.5) * 40 * cr).toFixed(1)}px, 0, 0) skewX(${((hash(Math.floor(lt * 24), 4) - 0.5) * 20 * cr).toFixed(1)}deg)`
      s.net.style.filter = crashed && lt < crashT + 0.5 ? `blur(${(hash(Math.floor(lt * 24)) * 3).toFixed(1)}px)` : ''
      sfx('crash', crashT)

      // E
      const eIn = c.L(5) - 0.1
      s.lo.style.visibility = lt >= eIn ? 'inherit' : 'hidden'
      pop(s.lo, lt, eIn, { dur: 0.5, from: 0.8 })
      sfx('thunk', eIn)
    },
  },
}

// ---------- a vacuum tube (canvas) ----------

function drawTube(ctx, x, y, glow, alpha = 1) {
  const w = 96
  const h = 150
  ctx.save()
  ctx.globalAlpha = alpha
  // Halo.
  if (glow > 0.02) {
    const halo = ctx.createRadialGradient(x + w / 2, y + 70, 4, x + w / 2, y + 70, 110)
    halo.addColorStop(0, `rgba(255,170,80,${(0.55 * glow).toFixed(3)})`)
    halo.addColorStop(1, 'rgba(255,170,80,0)')
    ctx.fillStyle = halo
    ctx.fillRect(x - 70, y - 50, w + 140, h + 120)
  }
  // Glass envelope.
  ctx.beginPath()
  ctx.moveTo(x + 14, y + 128)
  ctx.lineTo(x + 14, y + 40)
  ctx.bezierCurveTo(x + 14, y - 2, x + w - 14, y - 2, x + w - 14, y + 40)
  ctx.lineTo(x + w - 14, y + 128)
  ctx.closePath()
  ctx.fillStyle = `rgba(${Math.round(40 + 60 * glow)},${Math.round(34 + 40 * glow)},${Math.round(26 + 14 * glow)},0.9)`
  ctx.fill()
  ctx.strokeStyle = 'rgba(233,223,201,0.35)'
  ctx.lineWidth = 2
  ctx.stroke()
  // Electrodes.
  ctx.fillStyle = 'rgba(20,17,13,0.9)'
  ctx.fillRect(x + 30, y + 42, w - 60, 70)
  // Filament.
  const core = ctx.createRadialGradient(x + w / 2, y + 76, 1, x + w / 2, y + 76, 40)
  core.addColorStop(0, `rgba(255,236,190,${glow.toFixed(3)})`)
  core.addColorStop(0.35, `rgba(255,150,60,${(0.8 * glow).toFixed(3)})`)
  core.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = core
  ctx.fillRect(x + 8, y + 30, w - 16, 96)
  // Highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(x + 22, y + 26, 5, 90)
  // Base and pins.
  ctx.fillStyle = '#2a241c'
  ctx.fillRect(x + 8, y + 128, w - 16, 22)
  ctx.fillStyle = '#6d6454'
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 24 + i * 15, y + 150, 4, 12)
  ctx.restore()
}
