// Eras 5–11: pixels, the web, touch, neural networks, Go, language models, now.

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
  typeText,
} from './lib.js'

// Chromium cannot draw the colour emoji font, so emoji are Noto PNGs.
const emo = (ch, size = 64) => {
  const code = [...ch]
    .map((c) => c.codePointAt(0).toString(16))
    .join('-')
  return `<img src="../node_modules/emoji-datasource-google/img/google/64/${code}.png" style="display:block;width:${size}px;height:${size}px">`
}

// ---------------------------------------------------------------- pixel engine

const P8 = {
  black: '#000000',
  navy: '#1d2b53',
  plum: '#7e2553',
  green: '#008751',
  brown: '#ab5236',
  dgray: '#5f574f',
  lgray: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  lime: '#00e436',
  blue: '#29adff',
  lav: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
}

const PW = 180
const PH = 320
const TEXT_CACHE = new Map()

// Text rasterised at native pixel size and thresholded: real 1-bit glyphs.
function pixelText(ctx, text, x, y, color, size = 8, font = '"JetBrains Mono"', weight = 700) {
  const key = `${text}|${color}|${size}|${font}|${weight}`
  let img = TEXT_CACHE.get(key)
  if (!img) {
    const c = document.createElement('canvas')
    const m = c.getContext('2d')
    m.font = `${weight} ${size}px ${font}`
    const w = Math.ceil(m.measureText(text).width) + 2
    const h = Math.ceil(size * 1.4)
    c.width = w
    c.height = h
    m.font = `${weight} ${size}px ${font}`
    m.textBaseline = 'top'
    m.fillStyle = '#fff'
    m.fillText(text, 1, 1)
    const data = m.getImageData(0, 0, w, h)
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    for (let i = 0; i < data.data.length; i += 4) {
      const on = data.data[i + 3] > 120
      data.data[i] = r
      data.data[i + 1] = g
      data.data[i + 2] = b
      data.data[i + 3] = on ? 255 : 0
    }
    m.clearRect(0, 0, w, h)
    m.putImageData(data, 0, 0)
    img = c
    TEXT_CACHE.set(key, img)
  }
  ctx.drawImage(img, Math.round(x), Math.round(y))
  return img.width
}

function sprite(ctx, rows, x, y, palette, scale = 1) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = palette[row[i]]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), scale, scale)
    }
  })
}

const ARROW = ['X.......', 'XX......', 'XWX.....', 'XWWX....', 'XWWWX...', 'XWWWWX..', 'XWWWWWX.', 'XWWWXXXX', 'XWXWX...', 'XX.XWX..', 'X...XX..']
const FLOPPY = ['XXXXXXXXXXXX', 'XBBWWWWWWBBX', 'XBBWWWWWWBBX', 'XBBWWWWWWBBX', 'XBBBBBBBBBBX', 'XBBBBBBBBBBX', 'XBBLLLLLLBBX', 'XBBLLDDLLBBX', 'XBBLLDDLLBBX', 'XXXXXXXXXXXX']
const FOLDER = ['.XXXX.......', 'XYYYYX......', 'XYYYYYXXXXXX', 'XOOOOOOOOOOX', 'XOOOOOOOOOOX', 'XOOOOOOOOOOX', 'XOOOOOOOOOOX', 'XOOOOOOOOOOX', 'XXXXXXXXXXXX']
const TRASH = ['...XXXX...', '.XXXXXXXX.', '..XLLLLX..', '..XLXLXX..', '..XLXLXX..', '..XLXLXX..', '..XLXLXX..', '..XXXXXX..']

const cat16 = [
  '................',
  '..X..........X..',
  '..XX........XX..',
  '..XOX......XOX..',
  '..XOOXXXXXXOOX..',
  '..XOOOOOOOOOOX..',
  '.XOOOOOOOOOOOOX.',
  '.XOOEEOOOOEEOOX.',
  '.XOOEEOOOOEEOOX.',
  '.XOOOOOOOOOOOOX.',
  '.XOOOOONNOOOOOX.',
  '.XOOWOOOOOOWOOX.',
  '..XOOWWOOWWOOX..',
  '...XOOOOOOOOX...',
  '....XXXXXXXX....',
  '................',
]

// ---------------------------------------------------------------- scenes

export const SCENES = {
  // ================================================================ 1977–1984 像素
  pc: {
    wipe: '#ff004d',
    year: (lt, c) => (lt < c.L(1) ? 1977 : 1984),
    build(root, c) {
      const s = {}
      s.cv = canvas(root, PW, PH, { width: 1080, height: 1920, imageRendering: 'pixelated' })
      s.ctx = s.cv.getContext('2d')
      s.ctx.imageSmoothingEnabled = false
      const r = rng(1984)
      s.people = []
      for (let j = 0; j < 10; j++)
        for (let i = 0; i < 8; i++)
          s.people.push({
            x: 8 + i * 21,
            y: 84 + j * 15,
            t: r(),
            shirt: [P8.red, P8.blue, P8.orange, P8.lime, P8.pink, P8.yellow, P8.lav][Math.floor(r() * 7)],
            skin: [P8.peach, P8.orange, P8.brown][Math.floor(r() * 3)],
          })
      return s
    },
    render(s, lt, c) {
      const ctx = s.ctx
      const step = (x, n = 6) => Math.floor(clamp(x) * n) / n // 8-bit animation
      const blink = Math.floor(lt * 2.5) % 2 === 0
      ctx.fillStyle = P8.navy
      ctx.fillRect(0, 0, PW, PH)

      const zoomIn = step(prog(lt, c.L(1) - 0.3, 0.6), 5)
      const zoomOut = step(prog(lt, c.L(2) - 0.2, 0.6), 5)

      if (zoomOut > 0) {
        // --- C: everyone gets one
        ctx.fillStyle = P8.navy
        ctx.fillRect(0, 0, PW, PH)
        pixelText(ctx, '每一个人', 58, 52, P8.white, 16, '"Noto Sans SC"', 900)
        const fill = prog(lt, c.L(2), c.E(2) - c.L(2) + 0.2)
        let shown = 0
        for (const p of s.people) {
          if (p.t > fill) continue
          shown++
          const bob = Math.floor(lt * 4 + p.t * 10) % 2
          drawDesk(ctx, p.x, p.y + bob * 0, p, blink, lt)
        }
        pixelText(ctx, `× ${shown}`, 72, 238, P8.yellow, 12)
        for (let k = 0; k < 8; k++) sfx('blip', c.L(2) + k * 0.45)
        if (lt > c.E(2)) {
          for (let k = 0; k < 12; k++) {
            const x = Math.floor(hash(k, 3) * PW)
            const y = Math.floor(hash(k, 4) * PH)
            if ((Math.floor(lt * 6) + k) % 3 === 0) {
              ctx.fillStyle = P8.white
              ctx.fillRect(x, y, 1, 1)
              ctx.fillRect(x - 1, y, 3, 1)
              ctx.fillRect(x, y - 1, 1, 3)
            }
          }
        }
        return
      }

      if (zoomIn < 1) {
        // --- A: machine room shrinks onto a desk
        const shrink = step(prog(lt, 1.2, 1.6), 6)
        // Mainframe cabinets.
        const sc = lerp(1, 0.25, shrink)
        const ox = lerp(10, 58, shrink)
        const oy = lerp(70, 150, shrink)
        for (let k = 0; k < 3; k++) {
          const x = ox + k * 54 * sc
          ctx.fillStyle = P8.lgray
          ctx.fillRect(x, oy, 48 * sc, 140 * sc)
          ctx.fillStyle = P8.dgray
          ctx.fillRect(x + 4 * sc, oy + 8 * sc, 40 * sc, 44 * sc)
          // Tape reels, turning in 4 steps.
          for (const dx of [14, 34]) {
            const cx = x + dx * sc
            const cy = oy + 30 * sc
            ctx.fillStyle = P8.white
            ctx.fillRect(cx - 7 * sc, cy - 7 * sc, 14 * sc, 14 * sc)
            ctx.fillStyle = P8.black
            const a = (Math.floor(lt * 8) % 4) * (Math.PI / 4)
            ctx.fillRect(cx + Math.cos(a) * 4 * sc - sc, cy + Math.sin(a) * 4 * sc - sc, 2 * sc, 2 * sc)
          }
          for (let j = 0; j < 6; j++) {
            ctx.fillStyle = (Math.floor(lt * 5) + j + k) % 3 ? P8.red : P8.yellow
            ctx.fillRect(x + (8 + (j % 3) * 12) * sc, oy + (66 + Math.floor(j / 3) * 10) * sc, 4 * sc, 4 * sc)
          }
        }
        if (shrink < 1) pixelText(ctx, '机房', 72, 52, P8.white, 16, '"Noto Sans SC"', 900)
        sfx('chip-down', 1.2, { dur: 1.6 })

        // Desk + personal computer.
        const deskIn = step(prog(lt, 2.2, 0.8), 4)
        if (deskIn > 0) {
          const y0 = lerp(PH, 0, deskIn)
          drawPC(ctx, 40, 116 + y0, blink, lt)
          pixelText(ctx, '书桌', 72, 52, P8.white, 16, '"Noto Sans SC"', 900)
          pixelText(ctx, '个人电脑', 58, 76 + y0, P8.yellow, 16, '"Noto Sans SC"', 900)
        }
        if (zoomIn > 0) {
          // Zooming into the monitor: a white frame closing in.
          const k = zoomIn
          ctx.fillStyle = P8.navy
          ctx.fillRect(0, 0, PW, lerp(0, 116, 1 - k) * 0 + 116 * k)
        }
        return
      }

      // --- B: the desktop GUI
      ctx.fillStyle = P8.lav
      ctx.fillRect(0, 0, PW, PH)
      // Checkered desktop pattern.
      ctx.fillStyle = '#76698e'
      for (let y = 20; y < PH; y += 4) for (let x = (y / 4) % 2 ? 0 : 2; x < PW; x += 4) ctx.fillRect(x, y, 1, 1)
      // Menu bar.
      ctx.fillStyle = P8.white
      ctx.fillRect(0, 48, PW, 13)
      ctx.fillStyle = P8.black
      ctx.fillRect(0, 61, PW, 1)
      pixelText(ctx, '★ 文件 编辑 显示', 4, 48, P8.black, 10, '"Noto Sans SC"', 700)
      const t0 = c.L(1)
      const icons = [
        [FLOPPY, 146, 72, '磁盘', { X: P8.black, B: P8.blue, W: P8.white, L: P8.lgray, D: P8.dgray }],
        [FOLDER, 146, 112, '文件夹', { X: P8.black, Y: P8.yellow, O: P8.orange }],
        [TRASH, 147, 206, '废纸篓', { X: P8.black, L: P8.lgray }],
      ]
      icons.forEach(([spr, x, y, name, pal], i) => {
        if (lt < t0 + 0.1 + i * 0.25) return
        sprite(ctx, spr, x, y, pal, 2)
        pixelText(ctx, name, x - 8, y + (spr.length * 2) + 1, P8.white, 10, '"Noto Sans SC"', 700)
      })
      for (let i = 0; i < 3; i++) sfx('blip', t0 + 0.1 + i * 0.25)
      // Mouse path: to the folder, double-click, window opens.
      const mStart = c.W(1, '鼠标') - 1.0
      const mp = step(prog(lt, mStart, 0.9), 9)
      const mx = lerp(40, 158, mp)
      const my = lerp(220, 124, mp)
      const winT = mStart + 1.2
      const wp = step(prog(lt, winT, 0.5), 5)
      if (wp > 0) {
        const w = Math.round(lerp(20, 132, wp))
        const h = Math.round(lerp(14, 150, wp))
        const x = 10
        const y = 72
        ctx.fillStyle = P8.black
        ctx.fillRect(x + 2, y + 2, w, h)
        ctx.fillStyle = P8.white
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = P8.black
        ctx.strokeStyle = P8.black
        ctx.fillRect(x, y, w, 1)
        ctx.fillRect(x, y + h - 1, w, 1)
        ctx.fillRect(x, y, 1, h)
        ctx.fillRect(x + w - 1, y, 1, h)
        for (let k = 0; k < 4; k++) ctx.fillRect(x + 2, y + 3 + k * 2, w - 4, 1)
        ctx.fillStyle = P8.white
        ctx.fillRect(x + w / 2 - 22, y + 2, 44, 8)
        if (wp >= 1) {
          pixelText(ctx, '文件夹', x + w / 2 - 15, y, P8.black, 10, '"Noto Sans SC"', 700)
          sprite(ctx, FLOPPY, x + 14, y + 22, { X: P8.black, B: P8.red, W: P8.white, L: P8.lgray, D: P8.dgray }, 2)
          sprite(ctx, FOLDER, x + 60, y + 22, { X: P8.black, Y: P8.yellow, O: P8.orange }, 2)
          pixelText(ctx, 'HELLO.TXT', x + 8, y + 50, P8.black, 8)
          pixelText(ctx, '游戏', x + 62, y + 48, P8.black, 10, '"Noto Sans SC"', 700)
          pixelText(ctx, '> 你好，世界', x + 8, y + 80, P8.green, 10, '"Noto Sans SC"', 700)
          if (blink) {
            ctx.fillStyle = P8.green
            ctx.fillRect(x + 8, y + 96, 5, 8)
          }
        }
      }
      sfx('click', winT - 0.25)
      sfx('click', winT - 0.1)
      sfx('blip', winT)
      sprite(ctx, ARROW, mx, my, { X: P8.black, W: P8.white }, 2)
    },
  },

  // ================================================================ 1991–1997 万维网
  web: {
    wipe: '#c0c0c0',
    year: (lt, c) => (lt < c.L(2) ? 1991 : 1997),
    build(root, c) {
      const s = {}
      root.style.background = 'var(--teal)'
      const bevel = 'inset -3px -3px 0 #404040, inset 3px 3px 0 #fff, inset -6px -6px 0 #808080, inset 6px 6px 0 #dfdfdf'
      const win = (title, html, box, icon = '') =>
        put(
          root,
          'abs',
          `<div style="height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 14px;background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-size:28px;font-weight:700">
             <span style="white-space:nowrap;overflow:hidden">${icon}${title}</span>
             <span style="display:flex;gap:4px">${['_', '□', '×'].map((g) => `<b style="width:34px;height:30px;display:flex;align-items:center;justify-content:center;background:#c0c0c0;color:#000;font-size:22px;box-shadow:inset -2px -2px 0 #404040, inset 2px 2px 0 #fff">${g}</b>`).join('')}</span>
           </div>
           <div class="body" style="margin-top:6px">${html}</div>`,
          { padding: '6px', background: 'var(--gray)', boxShadow: bevel, fontFamily: 'var(--sans)', color: '#000', ...box },
        )
      s.bevel = bevel
      // Desktop icons.
      s.icons = ['我的电脑', '网上邻居', '回收站'].map((name, i) =>
        put(
          root,
          'abs',
          `<div style="width:72px;height:60px;margin:0 auto 10px;background:${['#c0c0c0', '#ffff80', '#e0e0e0'][i]};border:3px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,.4)"></div><div style="font-size:26px;color:#fff;text-align:center">${name}</div>`,
          { left: 40, top: 330 + i * 150, width: 140 },
        ),
      )
      // First website.
      s.www = win(
        'WorldWideWeb — info.cern.ch',
        `<div style="background:#fff;padding:30px 34px;height:560px;box-shadow:inset 2px 2px 0 #808080;font-family:'Noto Serif SC',serif;line-height:1.45">
           <div style="font-size:54px;font-weight:700;margin-bottom:14px">World Wide Web</div>
           <div class="wtext" style="font-size:31px"></div>
         </div>`,
        { left: 70, top: 380, width: 940 },
      )
      s.wtext = $('.wtext', s.www)
      s.wcopy =
        'The WorldWideWeb (W3) is a wide-area <u>hypermedia</u> information retrieval initiative aiming to give universal access to a large universe of documents.'
      s.firstTag = put(root, 'abs', '1991 · 世界上第一个网站', {
        left: 70,
        top: 1080,
        padding: '10px 20px',
        background: '#ffffe1',
        border: '2px solid #000',
        fontSize: 32,
        color: '#000',
      })

      // Dial-up.
      s.dial = win(
        '拨号网络',
        `<div style="padding:24px 26px;font-size:32px;line-height:1.6">
           <div style="display:flex;align-items:center;gap:26px">
             <div style="width:110px;height:70px;background:#dcdcdc;border:3px solid #000;position:relative"><i class="led" style="position:absolute;left:14px;top:40px;width:14px;height:10px;background:#0f0"></i><i class="led2" style="position:absolute;left:38px;top:40px;width:14px;height:10px;background:#f00"></i></div>
             <div class="st">正在拨号……</div>
           </div>
           <div style="margin-top:24px;height:44px;padding:4px;background:#fff;box-shadow:inset 2px 2px 0 #808080, inset -2px -2px 0 #fff;display:flex;gap:4px" class="bar"></div>
           <div class="spd" style="margin-top:12px;font-size:28px;color:#404040">56 Kbps</div>
         </div>`,
        { left: 170, top: 700, width: 740 },
      )
      s.dialSt = $('.st', s.dial)
      s.dialBar = $('.bar', s.dial)
      s.blocks = []
      for (let i = 0; i < 18; i++) {
        const b = document.createElement('i')
        b.style.cssText = 'display:block;width:30px;height:100%;background:#000080'
        s.dialBar.appendChild(b)
        s.blocks.push(b)
      }
      // A cascade of homepages.
      const pages = [
        ['欢迎光临我的主页！', '#ffff00', '#ff0000'],
        ['访问计数：000128', '#000', '#0f0'],
        ['网络日志 · 1996', '#fff', '#000080'],
        ['正在建设中……', '#ffcc00', '#000'],
        ['新闻 · 天气 · 股票', '#fff', '#800000'],
        ['我的留言簿', '#c0ffc0', '#004000'],
        ['在线聊天室', '#000', '#ff00ff'],
        ['搜索引擎', '#fff', '#0000ff'],
      ]
      s.pages = pages.map(([t, bg, fg], i) =>
        win(
          `http://www.${['home', 'counter', 'blog', 'build', 'news', 'guest', 'chat', 'search'][i]}.com`,
          `<div style="height:170px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;${i === 3 ? 'background:repeating-linear-gradient(45deg,#ffcc00 0 30px,#000 30px 60px);color:#fff;text-shadow:2px 2px 0 #000' : ''}">${t}</div>`,
          { left: 60 + (i % 4) * 70 + (i > 3 ? 180 : 0), top: 360 + i * 110, width: 620 },
        ),
      )

      // Deep Blue.
      s.chess = win(
        '深蓝 vs 卡斯帕罗夫 · 1997.5',
        `<div style="padding:14px;display:flex;flex-direction:column;align-items:center">
           <div class="board" style="position:relative;width:720px;height:720px;box-shadow:inset 0 0 0 3px #000"></div>
           <div style="margin-top:14px;display:flex;width:720px;justify-content:space-between;font-size:34px;font-weight:700">
             <span>深蓝</span><span class="score" style="font-family:var(--mono)">3½ : 2½</span><span>卡斯帕罗夫</span>
           </div>
         </div>`,
        { left: 120, top: 330, width: 780 },
      )
      s.board = $('.board', s.chess)
      s.score = $('.score', s.chess)
      for (let i = 0; i < 64; i++) {
        const sq = document.createElement('i')
        const x = i % 8
        const y = Math.floor(i / 8)
        sq.style.cssText = `position:absolute;left:${x * 90}px;top:${y * 90}px;width:90px;height:90px;background:${(x + y) % 2 ? '#7a7a7a' : '#dcdcdc'}`
        s.board.appendChild(sq)
      }
      // A middlegame, pieces labelled with their Chinese names.
      const pieces = [
        ['王', 6, 7, 'w'], ['后', 3, 5, 'w'], ['车', 0, 7, 'w'], ['车', 5, 7, 'w'], ['马', 4, 4, 'w'], ['象', 2, 6, 'w'],
        ['兵', 0, 6, 'w'], ['兵', 1, 5, 'w'], ['兵', 5, 6, 'w'], ['兵', 6, 6, 'w'], ['兵', 7, 5, 'w'],
        ['王', 6, 0, 'b'], ['后', 2, 2, 'b'], ['车', 3, 0, 'b'], ['车', 4, 0, 'b'], ['马', 5, 2, 'b'], ['象', 1, 1, 'b'],
        ['兵', 0, 1, 'b'], ['兵', 2, 3, 'b'], ['兵', 5, 1, 'b'], ['兵', 6, 1, 'b'], ['兵', 7, 2, 'b'],
      ]
      s.pieces = pieces.map(([n, x, y, side]) => {
        const el = document.createElement('b')
        el.textContent = n
        el.style.cssText = `position:absolute;left:${x * 90 + 9}px;top:${y * 90 + 9}px;width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;${side === 'w' ? 'background:#fff;color:#000;border:3px solid #000' : 'background:#111;color:#fff;border:3px solid #111'}`
        s.board.appendChild(el)
        el.home = [x, y]
        return el
      })
      s.mover = s.pieces[4] // white knight
      s.mover.to = [5, 2]
      s.tree = canvas(root, 1080, 1920)
      s.tree.style.pointerEvents = 'none'
      s.tctx = s.tree.getContext('2d')
      s.nps = put(
        root,
        'abs',
        `<div style="font-size:28px;color:#000">每秒搜索</div><div class="n" style="font-family:var(--mono);font-weight:700;font-size:64px;color:#000080">0</div><div style="font-size:28px;color:#000">步棋</div>`,
        { left: 120, top: 1160, width: 540, padding: '18px 26px', background: 'var(--gray)', boxShadow: bevel },
      )
      s.npsN = $('.n', s.nps)
      s.only = put(root, 'abs', '只会下棋', {
        left: 690,
        top: 1180,
        padding: '14px 26px',
        border: '6px solid #c00000',
        color: '#c00000',
        fontSize: 58,
        fontWeight: '900',
        transform: 'rotate(-8deg)',
        background: 'rgba(255,255,255,0.85)',
      })
      return s
    },
    render(s, lt, c) {
      // --- A: first website
      const aOut = c.L(1) - 0.1
      s.icons.forEach((el, i) => fade(el, lt, 0.1 + i * 0.1, 0.1))
      const wIn = pop(s.www, lt, 0.3, { dur: 0.25, from: 0.9 })
      if (wIn > 0) s.www.style.opacity = lt < c.L(2) - 0.3 ? '1' : '0'
      typeText(s.wtext, s.wcopy.replace(/<\/?u>/g, ''), lt, 0.8, 70)
      if (lt > 0.8 + s.wcopy.length / 70) s.wtext.innerHTML = s.wcopy.replace('<u>', '<u style="color:#00e">')
      fade(s.firstTag, lt, c.W(0, '第一个'), 0.2)
      away(s.firstTag, lt, aOut, { dur: 0.2 })
      sfx('win', 0.3)

      // --- B: dial-up, then the web explodes
      const dIn = c.L(1) - 0.1
      const dOut = c.W(1, '全世界') - 0.1
      pop(s.dial, lt, dIn, { dur: 0.2, from: 0.9 })
      if (lt >= dOut) s.dial.style.visibility = 'hidden'
      const dp = prog(lt, dIn + 0.2, dOut - dIn - 0.4)
      s.blocks.forEach((b, i) => (b.style.visibility = dp * 18 > i ? 'visible' : 'hidden'))
      s.dialSt.textContent = dp < 0.35 ? '正在拨号……' : dp < 0.8 ? '正在验证用户名和密码……' : '已连接！'
      $('.led', s.dial).style.opacity = Math.floor(lt * 10) % 2 ? '1' : '0.2'
      $('.led2', s.dial).style.opacity = Math.floor(lt * 7) % 2 ? '1' : '0.2'
      sfx('dialup', dIn, { dur: dOut - dIn })
      s.pages.forEach((el, i) => {
        const at = dOut + i * 0.16
        pop(el, lt, at, { dur: 0.2, from: 0.85 })
        if (lt >= c.L(2) - 0.3) el.style.visibility = 'hidden'
        sfx('win', at)
      })

      // --- C: Deep Blue
      const cIn = c.L(2) - 0.2
      const cOn = lt >= cIn
      s.chess.style.visibility = cOn ? 'inherit' : 'hidden'
      pop(s.chess, lt, cIn, { dur: 0.25, from: 0.92 })
      s.pieces.forEach((el, i) => {
        el.style.opacity = prog(lt, cIn + 0.2 + i * 0.03, 0.1).toFixed(2)
      })
      const mv = ease.inOut(prog(lt, c.W(2, '击败') - 0.2, 0.5))
      const [hx, hy] = s.mover.home
      const [tx, ty] = s.mover.to
      s.mover.style.left = `${lerp(hx, tx, mv) * 90 + 9}px`
      s.mover.style.top = `${lerp(hy, ty, mv) * 90 + 9}px`
      s.pieces[15].style.visibility = mv >= 1 ? 'hidden' : 'visible' // black knight captured
      sfx('clack', c.W(2, '击败') + 0.3)
      s.score.style.opacity = prog(lt, c.W(2, '世界冠军'), 0.2).toFixed(2)

      // Search tree bursting from the board + counter.
      const ctx = s.tctx
      ctx.clearRect(0, 0, 1080, 1920)
      const tIn = c.L(3) - 0.1
      const grow = prog(lt, tIn, 2.6)
      if (grow > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        const r = rng(1997)
        const branch = (x, y, depth, ang, len) => {
          if (depth > 6) return
          const reach = clamp(grow * 7 - depth)
          if (reach <= 0) return
          const n = depth < 2 ? 4 : 3
          for (let i = 0; i < n; i++) {
            const a = ang + (i - (n - 1) / 2) * (0.9 / (depth + 1)) + (r() - 0.5) * 0.2
            const L = len * reach
            const x2 = x + Math.cos(a) * L
            const y2 = y + Math.sin(a) * L
            ctx.globalAlpha = 0.8 - depth * 0.1
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x2, y2)
            ctx.stroke()
            if (reach >= 1) branch(x2, y2, depth + 1, a, len * 0.72)
          }
        }
        branch(540, 1100, 0, Math.PI / 2, 110)
        ctx.globalAlpha = 1
      }
      rise(s.nps, lt, tIn, { dur: 0.3, dist: 10 })
      s.npsN.textContent = groupDigits(2e8 * ease.out(prog(lt, tIn, 1.6)))
      sfx('counter', tIn, { dur: 1.6 })
      pop(s.only, lt, c.W(3, '只会下棋'), { dur: 0.25, from: 1.8, base: 'rotate(-8deg)' })
      sfx('stamp', c.W(3, '只会下棋'))
    },
  },

  // ================================================================ 2007 触屏
  phone: {
    wipe: '#ffffff',
    build(root, c) {
      const s = {}
      root.style.background = '#050505'
      // Everything on the “phone screen” lives in s.ui (so we can zoom out to a device).
      s.dev = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '540px 900px' })
      s.body = put(s.dev, 'abs', '', {
        left: -70,
        top: -170,
        width: 1220,
        height: 2260,
        borderRadius: '150px',
        background: 'linear-gradient(145deg, #3a3a3e, #0b0b0d 40%, #1b1b1f)',
        boxShadow: 'inset 0 0 0 6px #8b8b90, inset 0 0 0 14px #111',
        opacity: '0',
      })
      s.home = put(s.body, 'abs', '', { left: 540, top: 2110, width: 140, height: 140, borderRadius: '50%', border: '6px solid #555' })
      s.ui = put(s.dev, 'abs', '', {
        left: 0,
        top: 0,
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 20%, #2b3a55, #06080d 70%)',
      })
      s.lock = put(
        s.ui,
        'abs',
        `<div style="position:absolute;left:0;right:0;top:300px;height:330px;background:linear-gradient(rgba(255,255,255,.18),rgba(255,255,255,.05));border-bottom:2px solid rgba(255,255,255,.2)"></div>
         <div style="position:absolute;left:0;right:0;top:330px;text-align:center;font-family:Inter;font-weight:400;font-size:200px;color:#fff;letter-spacing:-.02em">9:41</div>
         <div style="position:absolute;left:0;right:0;top:560px;text-align:center;font-size:42px;color:#fff">1月9日 星期二</div>
         <div style="position:absolute;left:90px;right:90px;top:1240px;height:150px;border-radius:40px;background:linear-gradient(rgba(255,255,255,.2),rgba(0,0,0,.5));box-shadow:inset 0 2px 0 rgba(255,255,255,.3)">
           <div class="slide" style="position:absolute;left:12px;top:12px;width:190px;height:126px;border-radius:30px;background:linear-gradient(#fafafa,#b8b8b8);display:flex;align-items:center;justify-content:center;font-size:70px;color:#666">➜</div>
           <div class="hint" style="position:absolute;left:240px;top:44px;font-size:52px;color:rgba(255,255,255,.8)">滑动来解锁</div>
         </div>`,
        { left: 0, top: 0, width: 1080, height: 1920 },
      )
      s.slide = $('.slide', s.lock)
      s.hint = $('.hint', s.lock)
      s.finger = put(s.ui, 'abs', '', {
        left: 0,
        top: 0,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.35)',
        border: '4px solid rgba(255,255,255,0.8)',
      })
      // Home screen.
      const apps = [
        ['📞', '#35c759'], ['💬', '#34c759'], ['📷', '#8e8e93'], ['🖼️', '#ff9500'],
        ['🗺️', '#5ac8fa'], ['🎵', '#ff2d55'], ['⏰', '#1c1c1e'], ['🧮', '#333'],
        ['⛅', '#0a84ff'], ['📝', '#ffcc00'], ['✉️', '#007aff'], ['🧭', '#fff'],
        ['📅', '#fff'], ['🎮', '#5856d6'], ['📚', '#ff9f0a'], ['⚙️', '#8e8e93'],
      ]
      s.apps = apps.map(([e, bg], i) =>
        put(
          s.ui,
          'abs center',
          emo(e, 110),
          {
            left: 90 + (i % 4) * 240,
            top: 380 + Math.floor(i / 4) * 260,
            width: 180,
            height: 180,
            borderRadius: '42px',
            background: `linear-gradient(${bg}, ${bg}), linear-gradient(rgba(255,255,255,.35), rgba(255,255,255,0))`,
            backgroundBlendMode: 'normal',
            boxShadow: 'inset 0 90px 0 rgba(255,255,255,0.14), 0 10px 20px rgba(0,0,0,0.5)',
          },
        ),
      )
      s.dock = put(s.ui, 'abs', '', {
        left: 0,
        top: 1460,
        width: 1080,
        height: 460,
        background: 'linear-gradient(rgba(255,255,255,.12), rgba(255,255,255,.04))',
        borderTop: '2px solid rgba(255,255,255,.2)',
      })
      s.thisOne = put(
        root,
        'abs',
        `<div style="font-size:50px;font-weight:700">↑ 就是你手里这块</div><div style="font-size:34px;opacity:.7;margin-top:8px">竖屏 · 9:16</div>`,
        { left: 0, top: 1235, width: 1080, textAlign: 'center', color: '#fff' },
      )

      // Billions of phones.
      s.wall = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.minis = []
      const r = rng(2007)
      const icons = ['📷', '💬', '❤️', '👍', '🎵', '📍', '😂', '🔥', '⌨️', '🎬']
      for (let j = 0; j < 9; j++)
        for (let i = 0; i < 7; i++) {
          const el = put(
            s.wall,
            'abs',
            `<div style="position:absolute;inset:10px 7px 18px;border-radius:10px;background:hsl(${Math.floor(r() * 360)},45%,${30 + r() * 25}%)"></div>
             <div class="ic" style="position:absolute;left:50%;top:-34px;margin-left:-28px;width:56px;height:56px">${emo(icons[Math.floor(r() * icons.length)], 56)}</div>`,
            {
              left: 48 + i * 142,
              top: 320 + j * 124,
              width: 70,
              height: 118,
              borderRadius: '16px',
              background: '#111',
              border: '3px solid #666',
            },
          )
          el.seed = r()
          el.ic = $('.ic', el)
          s.minis.push(el)
        }
      // Data rising into an ocean.
      s.data = canvas(root, 1080, 1920)
      s.dctx = s.data.getContext('2d')
      s.oceanLbl = put(root, 'abs', '数据', {
        left: 0,
        top: 1150,
        width: 1080,
        textAlign: 'center',
        fontSize: 120,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: '0.3em',
      })
      s.node = put(root, 'abs', '', {
        left: 480,
        top: 560,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #fff, #7fd4ff 40%, rgba(127,212,255,0) 70%)',
      })
      return s
    },
    render(s, lt, c) {
      // --- unlock
      const sw = ease.inOut(prog(lt, c.W(0, '发布') - 0.1, 0.8))
      s.slide.style.transform = `translateX(${(sw * 690).toFixed(1)}px)`
      s.hint.style.opacity = (1 - sw * 1.5).toFixed(2)
      const fOn = prog(lt, c.W(0, '发布') - 0.35, 0.2) * (1 - prog(lt, c.W(0, '发布') + 0.8, 0.2))
      s.finger.style.opacity = fOn.toFixed(3)
      s.finger.style.transform = `translate3d(${(150 + sw * 690).toFixed(1)}px, 1255px, 0)`
      sfx('unlock', c.W(0, '发布') + 0.7)
      const unlocked = prog(lt, c.W(0, '发布') + 0.7, 0.3)
      s.lock.style.opacity = (1 - unlocked).toFixed(3)
      s.lock.style.transform = `scale(${lerp(1, 1.15, unlocked).toFixed(3)})`
      s.apps.forEach((el, i) => {
        const at = c.W(0, '钻进') - 0.4 + (i % 4) * 0.05 + Math.floor(i / 4) * 0.07
        pop(el, lt, at, { dur: 0.45, from: 0.3 })
      })
      fade(s.dock, lt, c.W(0, '钻进') - 0.4, 0.3)
      for (let i = 0; i < 4; i++) sfx('bubble', c.W(0, '钻进') - 0.4 + i * 0.07)

      // --- zoom out to a device: “this screen”
      const z = ease.inOut(prog(lt, c.L(1) - 0.1, 0.9))
      const z2 = ease.inOut(prog(lt, c.L(2) - 0.2, 0.7))
      const sc = lerp(1, 0.46, z) * lerp(1, 0.2, z2)
      s.dev.style.transform = `translate3d(0, ${(-150 * z).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`
      s.body.style.opacity = z.toFixed(3)
      s.dev.style.opacity = (1 - prog(lt, c.L(2) + 0.1, 0.3)).toFixed(3)
      rise(s.thisOne, lt, c.W(1, '这块竖屏') - 0.1, { dur: 0.5, dist: 30 })
      away(s.thisOne, lt, c.L(2) - 0.3, { dur: 0.3 })
      sfx('whoosh', c.L(1) - 0.1)

      // --- billions of phones
      const wIn = c.L(2) - 0.1
      s.wall.style.visibility = lt >= wIn ? 'inherit' : 'hidden'
      const oceanUp = ease.inOut(prog(lt, c.L(3) - 0.2, 2.6))
      const wake = prog(lt, c.L(4) - 0.2, 1.2)
      s.minis.forEach((el, i) => {
        const at = wIn + el.seed * 0.9
        pop(el, lt, at, { dur: 0.35, from: 0.2 })
        const beat = (lt * 1.3 + el.seed * 5) % 1
        el.ic.style.opacity = lt > at + 0.3 && beat < 0.55 ? '1' : '0'
        el.ic.style.transform = `translateY(${(-beat * 40).toFixed(1)}px)`
        const top = 320 + Math.floor(i / 7) * 124
        const sub = clamp((top - lerp(1920, 1000, oceanUp)) / 200)
        if (lt >= c.L(3) - 0.2) el.style.opacity = ((+el.style.opacity || 0) * (1 - 0.7 * sub) * (1 - wake)).toFixed(3)
      })
      for (let i = 0; i < 6; i++) sfx('bubble', wIn + 0.1 + i * 0.15)

      // Particles rising from the phones into the ocean.
      const ctx = s.dctx
      ctx.clearRect(0, 0, 1080, 1920)
      if (lt >= c.L(2) + 0.4) {
        const level = lerp(1920, 1000, oceanUp)
        for (let k = 0; k < 420; k++) {
          const born = c.L(2) + 0.4 + hash(k, 1) * 5
          const age = lt - born
          if (age < 0) continue
          const life = 1.6
          const cyc = age % life
          const x = 60 + hash(k, 2) * 960
          const y = 400 + hash(k, 3) * 900 + cyc * 380
          if (y > level) continue
          const col = ['#ffcf5a', '#7fd4ff', '#ff6b9a', '#9dff8a'][k % 4]
          ctx.globalAlpha = 0.85 * (1 - wake * 0.7)
          ctx.fillStyle = col
          ctx.fillRect(x, y, 6, 6)
        }
        ctx.globalAlpha = 1
        // Ocean body with a moving surface.
        const g = ctx.createLinearGradient(0, level, 0, 1920)
        g.addColorStop(0, 'rgba(127,212,255,0.85)')
        g.addColorStop(1, 'rgba(20,40,90,0.95)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(0, 1920)
        for (let x = 0; x <= 1080; x += 20) ctx.lineTo(x, level + Math.sin(x / 70 + lt * 3) * 10 + Math.sin(x / 23 - lt * 5) * 4)
        ctx.lineTo(1080, 1920)
        ctx.closePath()
        ctx.fill()
        // Bits glinting in the ocean.
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '700 26px "JetBrains Mono"'
        for (let k = 0; k < 90; k++) {
          const x = hash(k, 7) * 1080
          const y = level + 40 + hash(k, 8) * (1920 - level)
          if ((Math.floor(lt * 4) + k) % 5 === 0) ctx.fillText(k % 2 ? '1' : '0', x, y)
        }
        // Stream from the ocean up into the waiting node.
        if (wake > 0) {
          for (let k = 0; k < 160; k++) {
            const p = (lt * 0.8 + hash(k, 11)) % 1
            const x0 = 100 + hash(k, 12) * 880
            const x = lerp(x0, 540, ease.in(p))
            const y = lerp(level, 620, p)
            ctx.globalAlpha = wake * (1 - p) * 0.9
            ctx.fillStyle = '#bfe9ff'
            ctx.fillRect(x, y, 5, 5)
          }
          ctx.globalAlpha = 1
        }
      }
      fade(s.oceanLbl, lt, c.W(3, '数据') - 0.3, 0.4)
      s.oceanLbl.style.opacity = ((+s.oceanLbl.style.opacity || 0) * (1 - wake)).toFixed(3)
      sfx('rise', c.L(3) - 0.2, { dur: 2.6 })
      const nodeP = prog(lt, c.W(4, '会学习') - 0.4, 0.5)
      s.node.style.opacity = nodeP.toFixed(3)
      s.node.style.transform = `scale(${(lerp(0.2, 1, ease.back(nodeP)) * (1 + 0.12 * Math.sin(lt * 6))).toFixed(3)})`
      sfx('ping', c.W(4, '会学习') - 0.4)
    },
  },

  // ================================================================ 1956 → 2012 神经网络
  neural: {
    wipe: '#7fd4ff',
    year: (lt, c) => {
      if (lt < c.W(1, '两度')) return 1956
      if (lt < c.W(1, '寒冬')) return 1974
      if (lt < c.L(2)) return 1987
      if (lt < c.L(4)) return 2006
      return 2012
    },
    engine: (lt, c) => (lt < c.L(2) ? '规则 · IF-THEN' : '神经网络'),
    build(root, c) {
      const s = {}
      root.style.background = '#070b18'
      s.bg = put(root, 'fill', '', {
        background: 'radial-gradient(ellipse at 50% 45%, rgba(40,80,160,0.35), rgba(7,11,24,0) 70%)',
      })
      // --- A: 1956
      s.a = put(
        root,
        'abs',
        `<div style="font-family:var(--type);font-size:30px;opacity:.7;line-height:1.5">A PROPOSAL FOR THE<br>DARTMOUTH SUMMER RESEARCH PROJECT ON</div>
         <div class="en" style="font-family:var(--type);font-weight:700;font-size:74px;line-height:1.15;margin-top:14px">ARTIFICIAL<br>INTELLIGENCE</div>
         <div style="height:3px;background:#cfe9ff;opacity:.5;margin:40px 0"></div>
         <div style="font-family:'Noto Sans SC';font-weight:900;font-size:150px;line-height:1">人工智能</div>
         <div style="font-size:40px;margin-top:26px;opacity:.85">1956 · 达特茅斯会议</div>`,
        { left: 96, top: 400, width: 900, color: '#cfe9ff' },
      )
      // --- B: rules pile up, then freeze
      s.b = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      const rules = [
        'IF 有羽毛 THEN 是鸟',
        'IF 会飞 AND 有羽毛 THEN 是鸟',
        'IF 企鹅 THEN 不会飞',
        'IF 发烧 AND 咳嗽 THEN 感冒?',
        'IF 下一步是“将” THEN ……',
        'IF 句子含“不” THEN 否定',
        'IF 有四条腿 AND 会叫 THEN 狗',
        'IF 猫 AND 趴着 THEN ???',
        'ELSE IF … ELSE IF … ELSE',
        'IF 光线暗 THEN 无法识别',
        'IF 口音 THEN 听不懂',
        'IF 例外 THEN 再加一条规则',
        'IF 例外的例外 THEN ……',
        'IF … THEN …',
      ]
      s.rules = rules.map((t, i) =>
        put(s.b, 'abs', t, {
          left: 70 + (hash(i, 1) * 120) | 0,
          top: 340 + i * 74,
          fontFamily: 'var(--code)',
          fontSize: 38,
          color: '#cfe9ff',
          whiteSpace: 'nowrap',
          padding: '6px 16px',
          border: '2px solid rgba(207,233,255,0.4)',
          background: 'rgba(20,40,80,0.6)',
          transform: `rotate(${((hash(i, 2) - 0.5) * 6).toFixed(1)}deg)`,
        }),
      )
      s.frost = put(s.b, 'fill', '', {
        background: 'linear-gradient(rgba(220,240,255,0.0), rgba(220,240,255,0.35))',
        opacity: '0',
      })
      s.snow = canvas(s.b, 1080, 1920)
      s.sctx = s.snow.getContext('2d')
      s.winters = [
        put(s.b, 'abs', 'AI 寒冬 · 1974', { left: 120, top: 700, fontSize: 84, fontWeight: '900', color: '#fff', padding: '14px 34px', background: 'rgba(120,170,220,0.5)', border: '4px solid #fff', transform: 'rotate(-6deg)' }),
        put(s.b, 'abs', 'AI 寒冬 · 1987', { left: 260, top: 980, fontSize: 84, fontWeight: '900', color: '#fff', padding: '14px 34px', background: 'rgba(120,170,220,0.5)', border: '4px solid #fff', transform: 'rotate(4deg)' }),
      ]
      // --- C–F: the network, top (input) to bottom (output)
      s.net = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.cv = canvas(s.net, 1080, 1920)
      s.ctx = s.cv.getContext('2d')
      const layers = [7, 9, 9, 7, 3]
      const Y = [560, 760, 960, 1160, 1330]
      s.layers = layers.map((n, li) =>
        Array.from({ length: n }, (_, k) => ({ x: 590 + (k - (n - 1) / 2) * (li === 4 ? 190 : 92), y: Y[li] })),
      )
      s.catBox = put(s.net, 'abs', '', { left: 490, top: 330, width: 200, height: 200 })
      s.catCv = canvas(s.catBox, 16, 16, { width: 200, height: 200, imageRendering: 'pixelated' })
      const cctx = s.catCv.getContext('2d')
      sprite(cctx, cat16, 0, 0, { X: '#1a1a1a', O: '#ff9f43', E: '#2ecc71', N: '#ff77a8', W: '#1a1a1a', '.': '#dfe7ef' })
      s.catLbl = put(s.net, 'abs', '输入：一张图片', { left: 720, top: 410, fontSize: 32, color: '#cfe9ff', opacity: '0.8' })
      s.feat = ['线条', '形状', '猫脸'].map((t, i) =>
        put(s.net, 'abs', `<span style="opacity:.6;font-size:26px">第 ${i + 1} 层</span><br><b style="font-size:40px">${t}</b>`, {
          left: 28,
          top: Y[i + 1] - 42,
          width: 170,
          textAlign: 'left',
          color: '#ffd166',
          lineHeight: '1.25',
          fontFamily: 'var(--grot)',
        }),
      )
      s.out = put(s.net, 'abs center', '', { left: 0, top: 1360, width: 1080, height: 60, fontFamily: 'var(--grot)', fontSize: 40, color: '#ffd166' })
      // --- E: AlexNet
      s.alex = put(
        root,
        'abs',
        `<div style="font-family:var(--grot);font-size:34px;opacity:.8">ImageNet 2012 · 识别错误率</div>
         <div class="rowA" style="margin-top:34px"><div style="display:flex;justify-content:space-between;font-size:36px"><span>第二名</span><b>26.2%</b></div><i style="display:block;height:44px;margin-top:10px;background:rgba(207,233,255,.35);transform-origin:left"></i></div>
         <div class="rowB" style="margin-top:30px"><div style="display:flex;justify-content:space-between;font-size:36px;color:#ffd166"><b>AlexNet</b><b>15.3%</b></div><i style="display:block;height:44px;margin-top:10px;background:#ffd166;transform-origin:left"></i></div>
         <div class="gpu" style="margin-top:50px;display:flex;gap:30px;align-items:center">
           ${[0, 1].map(() => `<div style="width:250px;height:100px;border:3px solid #cfe9ff;border-radius:10px;display:flex;align-items:center;justify-content:space-around;background:rgba(20,40,80,.6)"><i class="fan" style="width:64px;height:64px;border-radius:50%;border:6px dotted #cfe9ff"></i><i class="fan" style="width:64px;height:64px;border-radius:50%;border:6px dotted #cfe9ff"></i></div>`).join('')}
           <div style="font-size:32px;line-height:1.3">两块<br>游戏显卡</div>
         </div>`,
        { left: 96, top: 360, width: 888, padding: '40px', color: '#cfe9ff', background: 'rgba(7,11,24,0.88)', border: '2px solid rgba(207,233,255,0.4)', borderRadius: '16px' },
      )
      s.barA = $('.rowA i', s.alex)
      s.barB = $('.rowB i', s.alex)
      s.fans = $$('.fan', s.alex)
      s.deep = put(root, 'abs center', '深度学习', {
        left: 0,
        top: 820,
        width: 1080,
        height: 260,
        fontSize: 190,
        fontWeight: '900',
        color: '#fff',
        textShadow: '0 0 30px #7fd4ff, 0 0 80px #7fd4ff',
      })
      return s
    },
    render(s, lt, c) {
      // A
      rise(s.a, lt, 0.3, { dur: 0.7, dist: 30 })
      away(s.a, lt, c.L(1) - 0.3, { dur: 0.3 })
      sfx('typewriter', 0.3, { dur: 1.2 })

      // B
      const bIn = c.L(1) - 0.1
      const bOut = c.L(2) + 0.2
      s.b.style.visibility = lt >= bIn && lt < bOut + 0.6 ? 'inherit' : 'hidden'
      s.rules.forEach((el, i) => {
        const at = bIn + i * 0.14
        rise(el, lt, at, { dur: 0.25, dist: -30, base: el.style.transform.replace(/translate3d\([^)]*\)\s*/, '') })
        sfx('key', at)
      })
      const freeze = prog(lt, c.W(1, '两度') - 0.2, 0.8)
      s.frost.style.opacity = freeze.toFixed(3)
      s.rules.forEach((el) => {
        el.style.color = freeze > 0.5 ? '#ffffff' : '#cfe9ff'
        el.style.filter = freeze > 0 ? `saturate(${(1 - freeze).toFixed(2)}) brightness(${(1 + freeze * 0.3).toFixed(2)})` : ''
      })
      pop(s.winters[0], lt, c.W(1, '两度') - 0.1, { dur: 0.3, from: 1.6, base: 'rotate(-6deg)' })
      pop(s.winters[1], lt, c.W(1, '寒冬') - 0.1, { dur: 0.3, from: 1.6, base: 'rotate(4deg)' })
      sfx('freeze', c.W(1, '两度') - 0.2)
      sfx('stamp', c.W(1, '两度') - 0.1)
      sfx('stamp', c.W(1, '寒冬') - 0.1)
      const sctx = s.sctx
      sctx.clearRect(0, 0, 1080, 1920)
      if (freeze > 0) {
        sctx.fillStyle = '#fff'
        for (let k = 0; k < 160; k++) {
          const sp = 60 + hash(k, 1) * 120
          const y = (hash(k, 2) * 1920 + (lt - bIn) * sp) % 1920
          const x = hash(k, 3) * 1080 + Math.sin(lt * 1.5 + k) * 20
          sctx.globalAlpha = freeze * (0.4 + 0.6 * hash(k, 4))
          sctx.beginPath()
          sctx.arc(x, y, 2 + hash(k, 5) * 4, 0, TAU)
          sctx.fill()
        }
        sctx.globalAlpha = 1
      }
      // Thaw: everything falls away.
      const thaw = ease.in(prog(lt, c.L(2) - 0.1, 0.6))
      s.b.style.opacity = (1 - thaw).toFixed(3)
      s.b.style.transform = `translate3d(0, ${(thaw * 200).toFixed(1)}px, 0)`

      // C–F: network
      const nIn = c.W(2, '不写规则')
      s.net.style.visibility = lt >= nIn ? 'inherit' : 'hidden'
      const alexIn = c.L(4) - 0.1
      const alexOut = c.L(5) - 0.2
      const ctx = s.ctx
      ctx.clearRect(0, 0, 1080, 1920)
      const L = s.layers
      const deepGlow = prog(lt, c.L(5) - 0.1, 0.8)
      for (let li = 0; li < L.length - 1; li++) {
        const edgeIn = prog(lt, nIn + 0.2 + li * 0.3, 0.6)
        if (edgeIn <= 0) continue
        for (let a = 0; a < L[li].length; a++)
          for (let b = 0; b < L[li + 1].length; b++) {
            const A = L[li][a]
            const B = L[li + 1][b]
            const w = hash(li, a, b)
            ctx.strokeStyle = `rgba(127,212,255,${(edgeIn * (0.08 + 0.25 * w) + deepGlow * 0.3).toFixed(3)})`
            ctx.lineWidth = 1 + w * 2
            ctx.beginPath()
            ctx.moveTo(A.x, A.y)
            ctx.lineTo(lerp(A.x, B.x, edgeIn), lerp(A.y, B.y, edgeIn))
            ctx.stroke()
          }
      }
      // Pulses flowing downward once the cat is shown.
      const flowT = c.L(3) - 0.1
      if (lt >= flowT) {
        for (let k = 0; k < 120; k++) {
          const li = k % (L.length - 1)
          const a = Math.floor(hash(k, 1) * L[li].length)
          const b = Math.floor(hash(k, 2) * L[li + 1].length)
          const p = (lt * 1.2 + hash(k, 3)) % 1
          const A = L[li][a]
          const B = L[li + 1][b]
          ctx.fillStyle = '#ffd166'
          ctx.globalAlpha = 0.9 * Math.sin(p * Math.PI)
          ctx.beginPath()
          ctx.arc(lerp(A.x, B.x, p), lerp(A.y, B.y, p), 5, 0, TAU)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      const featT = [c.W(3, '线条'), c.W(3, '形状'), c.W(3, '一只猫')]
      L.forEach((layer, li) => {
        const on = prog(lt, nIn + li * 0.25, 0.4)
        const active = li === 0 ? prog(lt, flowT, 0.3) : li < 4 ? prog(lt, featT[li - 1] - 0.1, 0.3) : prog(lt, featT[2] + 0.2, 0.3)
        layer.forEach((n, k) => {
          const act = active * (0.4 + 0.6 * noise1(lt * 3 + k * 1.7 + li * 5, li)) + deepGlow
          ctx.globalAlpha = on
          ctx.fillStyle = '#0c1630'
          ctx.strokeStyle = '#7fd4ff'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(n.x, n.y, li === 4 ? 30 : 22, 0, TAU)
          ctx.fill()
          ctx.stroke()
          if (act > 0.02) {
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 48)
            g.addColorStop(0, `rgba(255,209,102,${clamp(act).toFixed(3)})`)
            g.addColorStop(1, 'rgba(255,209,102,0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(n.x, n.y, 48, 0, TAU)
            ctx.fill()
          }
        })
      })
      ctx.globalAlpha = 1
      for (let li = 0; li < 5; li++) sfx('ping', nIn + li * 0.25)
      pop(s.catBox, lt, flowT - 0.3, { dur: 0.4, from: 0.6 })
      fade(s.catLbl, lt, flowT - 0.1, 0.3)
      s.feat.forEach((el, i) => {
        fade(el, lt, featT[i] - 0.1, 0.3)
        sfx('blip', featT[i] - 0.1)
      })
      const outOn = prog(lt, featT[2] + 0.2, 0.3)
      s.out.innerHTML = outOn > 0 ? '输出：<b style="font-size:52px;margin:0 12px">猫</b> 98%　·　狗 1%　·　其他 1%' : ''
      s.out.style.opacity = outOn.toFixed(3)
      sfx('ding', featT[2] + 0.2)
      s.net.style.opacity = (1 - 0.8 * prog(lt, alexIn, 0.3) * (1 - prog(lt, alexOut, 0.3))).toFixed(3)

      // E: AlexNet card over the network
      s.alex.style.visibility = lt >= alexIn && lt < alexOut + 0.3 ? 'inherit' : 'hidden'
      rise(s.alex, lt, alexIn, { dur: 0.4, dist: 30 })
      away(s.alex, lt, alexOut, { dur: 0.3 })
      s.barA.style.transform = `scaleX(${(ease.out(prog(lt, c.W(4, '图像识别') - 0.3, 0.6)) * 0.262 / 0.3).toFixed(4)})`
      s.barB.style.transform = `scaleX(${(ease.out(prog(lt, c.W(4, '遥遥领先') - 0.2, 0.6)) * 0.153 / 0.3).toFixed(4)})`
      s.fans.forEach((f) => (f.style.transform = `rotate(${(lt * 720) % 360}deg)`))
      sfx('whoosh', alexIn)
      sfx('ding', c.W(4, '遥遥领先') - 0.2)

      // F
      const dIn = c.L(5) - 0.1
      s.deep.style.visibility = lt >= dIn ? 'inherit' : 'hidden'
      pop(s.deep, lt, dIn, { dur: 0.6, from: 0.7 })
      sfx('swell', dIn)
    },
  },

  // ================================================================ 2016 棋盘
  go: {
    wipe: '#ece4d2',
    build(root, c) {
      const s = {}
      put(root, 'fill', '', {
        background: 'radial-gradient(ellipse at 50% 40%, #f4eee0, #e3d8c0 100%)',
      })
      put(root, 'fill', '', {
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' seed='16'/><feColorMatrix values='0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`,
        mixBlendMode: 'multiply',
        opacity: '0.6',
      })
      s.title = put(
        root,
        'abs',
        `<div style="display:flex;align-items:baseline;gap:30px;font-family:var(--serif)">
           <b style="font-size:60px">AlphaGo</b><b style="font-size:96px;color:var(--seal)">4 : 1</b><b style="font-size:60px">李世石</b>
         </div>
         <div style="font-family:var(--serif);font-size:32px;margin-top:4px;opacity:.7">2016 年 3 月 · 首尔 · 五番棋</div>`,
        { left: 96, top: 300, color: 'var(--ink)' },
      )
      const N = 19
      const S = 45
      const X0 = 540 - 9 * S
      const Y0 = 550
      s.pos = (i, j) => [X0 + i * S, Y0 + j * S]
      let grid = ''
      for (let k = 0; k < N; k++) {
        grid += `<path d="M ${X0} ${Y0 + k * S} L ${X0 + 18 * S} ${Y0 + k * S}"/><path d="M ${X0 + k * S} ${Y0} L ${X0 + k * S} ${Y0 + 18 * S}"/>`
      }
      let stars = ''
      for (const i of [3, 9, 15]) for (const j of [3, 9, 15]) stars += `<circle cx="${X0 + i * S}" cy="${Y0 + j * S}" r="6" fill="#1a1a1a"/>`
      s.board = put(
        root,
        'abs',
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920">
           <rect x="${X0 - 40}" y="${Y0 - 40}" width="${18 * S + 80}" height="${18 * S + 80}" fill="#dcb46a" opacity=".85"/>
           <g stroke="#1a1a1a" stroke-width="2" class="gr">${grid}</g>${stars}
           <path class="enso" d="" fill="none" stroke="#141414" stroke-linecap="round"/>
         </svg>`,
        { left: 0, top: 0 },
      )
      s.grid = $('.gr', s.board)
      // Opening (illustrative): corners first, then sides.
      const moves = [
        [15, 3], [3, 15], [15, 15], [2, 3], [4, 2], [16, 13], [13, 16], [2, 13], [9, 3], [3, 9],
        [15, 9], [12, 2], [16, 5], [5, 16], [10, 16], [16, 10], [7, 2], [2, 7], [13, 13], [5, 5],
        [11, 4], [14, 7], [6, 14], [8, 15], [4, 11], [17, 16], [15, 17], [14, 11], [3, 5], [16, 7],
        [10, 10], [5, 12], [12, 14], [7, 6], [17, 3], [9, 13],
      ]
      s.stones = moves.map(([i, j], k) => {
        const [x, y] = s.pos(i, j)
        return put(root, 'abs', '', {
          left: x - 21,
          top: y - 21,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background:
            k % 2 === 0
              ? 'radial-gradient(circle at 35% 30%, #666, #111 45%, #000)'
              : 'radial-gradient(circle at 35% 30%, #fff, #e8e4da 60%, #b8b2a4)',
          boxShadow: '2px 3px 4px rgba(0,0,0,0.35)',
        })
      })
      const [mx, my] = s.pos(13, 9)
      s.m37 = put(root, 'abs', '', {
        left: mx - 21,
        top: my - 21,
        width: 42,
        height: 42,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #666, #111 45%, #000)',
        boxShadow: '2px 3px 4px rgba(0,0,0,0.35)',
      })
      s.ripple = put(root, 'abs', '', { left: mx - 21, top: my - 21, width: 42, height: 42, borderRadius: '50%', border: '5px solid var(--seal)' })
      s.lbl37 = put(
        root,
        'abs',
        `<div style="font-family:var(--serif);font-weight:900;font-size:46px">第 37 手</div><div class="q" style="font-family:var(--hand);font-weight:700;font-size:48px;margin-top:4px"></div>`,
        { left: mx - 250, top: my - 180, width: 300, textAlign: 'center', color: 'var(--ink)', padding: '14px 18px', background: 'rgba(244,239,227,0.94)', border: '3px solid var(--ink)' },
      )
      s.q = $('.q', s.lbl37)
      s.seal = put(
        root,
        'abs center',
        `<div style="writing-mode:vertical-rl;font-family:var(--serif);font-weight:900;font-size:64px;line-height:1.05;letter-spacing:.05em">妙手</div>`,
        { left: 860, top: 1235, width: 140, height: 170, background: 'var(--seal)', color: '#f6efe0', borderRadius: '10px', transform: 'rotate(-6deg)' },
      )
      s.note = put(root, 'abs', '棋局为示意', { left: X0 - 40, top: Y0 + 18 * S + 50, fontSize: 24, fontFamily: 'var(--serif)', color: 'var(--ink)', opacity: '0.5' })
      s.path = put(root, 'abs center', '一条人类没想到的路', {
        left: 0,
        top: 1100,
        width: 1080,
        height: 160,
        fontFamily: 'var(--hand)',
        fontWeight: '700',
        fontSize: 92,
        color: 'var(--ink)',
      })
      s.mx = mx
      s.my = my
      return s
    },
    render(s, lt, c) {
      rise(s.title, lt, 0.2, { dur: 0.5, dist: 20 })
      s.grid.style.opacity = prog(lt, 0.1, 0.4).toFixed(3)
      s.stones.forEach((el, k) => {
        const at = 0.5 + k * 0.085
        const p = prog(lt, at, 0.12)
        el.style.opacity = p.toFixed(2)
        el.style.transform = `scale(${lerp(1.3, 1, p).toFixed(3)})`
        if (k % 3 === 0) sfx('stone', at)
      })
      const t37 = c.W(1, '第37手') - 0.1
      const p = prog(lt, t37, 0.15)
      s.m37.style.opacity = p.toFixed(2)
      s.m37.style.transform = `scale(${lerp(1.5, 1, p).toFixed(3)})`
      sfx('stone', t37)
      sfx('gong', t37 + 0.05)
      const rp = (lt - t37) % 1.2
      s.ripple.style.opacity = lt >= t37 && lt < c.L(3) ? (1 - rp / 1.2).toFixed(3) : '0'
      s.ripple.style.transform = `scale(${(1 + rp * 3).toFixed(3)})`
      rise(s.lbl37, lt, t37 + 0.25, { dur: 0.4, dist: 20 })
      s.q.textContent = lt >= c.L(2) ? '！' : lt >= c.W(1, '失误') - 0.1 ? '失误？' : ''
      s.q.style.color = lt >= c.L(2) ? 'var(--seal)' : 'var(--ink)'
      pop(s.seal, lt, c.W(2, '决定胜负'), { dur: 0.3, from: 1.8, base: 'rotate(-6deg)' })
      sfx('stamp', c.W(2, '决定胜负'))
      fade(s.note, lt, 1, 0.5)

      // Ensō brushed around move 37, then the line.
      const ep = ease.inOut(prog(lt, c.L(3) - 0.1, 1.4))
      const enso = $('.enso', s.board)
      if (ep > 0) {
        const R = 190
        const pts = []
        const a0 = -2.2
        const n = 90
        for (let k = 0; k <= n * ep; k++) {
          const a = a0 + (k / n) * TAU * 0.93
          const r = R + Math.sin(k * 0.35) * 5
          pts.push(`${(s.mx + Math.cos(a) * r).toFixed(1)} ${(s.my + Math.sin(a) * r).toFixed(1)}`)
        }
        enso.setAttribute('d', `M ${pts.join(' L ')}`)
        enso.setAttribute('stroke-width', '26')
        enso.style.opacity = '0.85'
      } else enso.setAttribute('d', '')
      sfx('brush', c.L(3) - 0.1, { dur: 1.4 })
      const pp = ease.out(prog(lt, c.W(3, '走出了'), 0.8))
      s.path.style.clipPath = `inset(-20% ${((1 - pp) * 100).toFixed(2)}% -20% 0)`
      s.path.style.background = pp > 0 ? 'rgba(244,239,227,0.9)' : 'transparent'
    },
  },

  // ================================================================ 2017–2022 语言模型
  llm: {
    wipe: '#ffb000',
    year: (lt, c) => (lt < c.L(3) ? 2017 : 2022),
    build(root, c) {
      const s = {}
      root.style.background = '#0e0e0c'
      const A = 'var(--amber)'
      s.paper = put(
        root,
        'abs',
        `<div style="font-family:var(--grot);font-size:30px;opacity:.6">arXiv · 2017</div>
         <div style="font-family:'Noto Serif SC',serif;font-weight:700;font-size:82px;line-height:1.1;margin-top:10px">Attention Is<br>All You Need</div>
         <div style="font-family:var(--grot);font-size:34px;margin-top:22px;color:${A}">Transformer</div>`,
        { left: 96, top: 330, width: 900, color: 'var(--cream)' },
      )
      // Attention: tokens down the left, arcs on the right.
      s.tokens = ['小猫', '跳上', '桌子', '，', '因为', '它', '饿', '了']
      s.tokY = s.tokens.map((_, i) => 700 + i * 88)
      s.tokEls = s.tokens.map((t, i) =>
        put(root, 'abs', t, {
          left: 150,
          top: s.tokY[i] - 36,
          height: 72,
          padding: '0 22px',
          display: 'flex',
          alignItems: 'center',
          fontSize: 44,
          fontWeight: '700',
          color: 'var(--cream)',
          border: '2px solid rgba(242,239,230,0.35)',
          borderRadius: '10px',
          background: 'rgba(242,239,230,0.04)',
        }),
      )
      s.arcs = canvas(root, 1080, 1920)
      s.actx = s.arcs.getContext('2d')
      s.attLbl = put(root, 'abs', '“它”在注意谁？', { left: 560, top: 1370, fontSize: 40, color: A, fontWeight: '700' })

      // Next-word prediction.
      s.stream = put(root, 'abs', '', { left: 0, top: 300, width: 1080, height: 560, overflow: 'hidden', maskImage: 'linear-gradient(transparent, #000 25%, #000 70%, transparent)', WebkitMaskImage: 'linear-gradient(transparent, #000 25%, #000 70%, transparent)' })
      const lines = [
        '床前明月光，疑是地上霜。', 'To be, or not to be, that is the question.', 'def main(): print("hello")', 'E = mc²',
        '天行健，君子以自强不息。', '1 + 1 = 2', 'The quick brown fox jumps over the lazy dog.', '《百科全书》第 1 卷……',
        '今天天气不错，适合出去走走。', 'SELECT * FROM books;', '人之初，性本善。', 'All happy families are alike…',
        '论坛 · 回复 #1024', '新闻：……', 'Once upon a time…', '菜谱：番茄炒蛋',
      ]
      s.streamLines = lines.map((t, i) =>
        put(s.stream, 'abs', t, {
          left: 60 + (hash(i, 5) * 300) | 0,
          top: 0,
          fontSize: 30 + (hash(i, 6) * 14) | 0,
          fontFamily: i % 3 === 2 ? 'var(--code)' : 'var(--sans)',
          color: 'rgba(242,239,230,0.55)',
          whiteSpace: 'nowrap',
        }),
      )
      s.model = put(root, 'abs center', '模型', {
        left: 340,
        top: 620,
        width: 400,
        height: 120,
        borderRadius: '18px',
        border: `4px solid ${A}`,
        color: A,
        fontSize: 52,
        fontWeight: '700',
        background: '#16140f',
        boxShadow: '0 0 40px rgba(255,176,0,0.25)',
      })
      s.pred = put(
        root,
        'abs',
        `<div style="font-size:30px;opacity:.6;font-family:var(--grot)">预测下一个词</div>
         <div class="pr" style="font-size:78px;font-weight:700;margin:14px 0 26px"></div>
         ${[
           ['吗', 0.71],
           ['了', 0.12],
           ['的', 0.06],
           ['？', 0.04],
         ]
           .map(
             ([w, p]) =>
               `<div class="cand" style="display:flex;align-items:center;gap:20px;height:64px;font-size:40px"><b style="width:60px">${w}</b><i style="display:block;height:36px;width:${Math.round(p * 640)}px;background:${A};transform-origin:left;opacity:${p > 0.5 ? 1 : 0.45}"></i><span style="font-family:var(--grot);font-size:32px">${Math.round(p * 100)}%</span></div>`,
           )
           .join('')}`,
        { left: 96, top: 850, width: 900, color: 'var(--cream)' },
      )
      s.pr = $('.pr', s.pred)
      s.cands = $$('.cand', s.pred)

      // ChatGPT moment.
      s.chat = put(
        root,
        'abs',
        `<div class="u" style="margin-left:auto;max-width:640px;padding:24px 32px;border-radius:30px 30px 6px 30px;background:#2b2a26;font-size:42px;width:max-content">你能帮我做什么？</div>
         <div class="a" style="margin-top:30px;max-width:820px;padding:24px 32px;border-radius:30px 30px 30px 6px;border:2px solid rgba(242,239,230,.25);font-size:40px;line-height:1.5;min-height:140px"></div>`,
        { left: 96, top: 340, width: 888, color: 'var(--cream)' },
      )
      s.ans = $('.a', s.chat)
      s.users = put(
        root,
        'abs',
        `<div style="font-size:30px;opacity:.6;font-family:var(--grot)">用户突破 1 亿用了多久</div>
         ${[
           ['Instagram', '约 2.5 年', 1],
           ['TikTok', '约 9 个月', 0.3],
           ['ChatGPT', '约 2 个月', 0.067],
         ]
           .map(
             ([n, t, w], i) =>
               `<div class="ub" style="margin-top:22px"><div style="display:flex;justify-content:space-between;font-size:36px;${i === 2 ? 'color:var(--amber);font-weight:700' : ''}"><span>${n}</span><span>${t}</span></div><i style="display:block;height:30px;margin-top:8px;background:${i === 2 ? 'var(--amber)' : 'rgba(242,239,230,.3)'};transform-origin:left;width:${(w * 100).toFixed(1)}%"></i></div>`,
           )
           .join('')}`,
        { left: 96, top: 930, width: 888, color: 'var(--cream)' },
      )
      s.ubars = $$('.ub i', s.users)

      // Books: one lifetime vs the training data.
      s.books = canvas(root, 1080, 1920)
      s.bctx = s.books.getContext('2d')
      s.bookLbl = put(
        root,
        'abs',
        `<div class="me" style="font-size:36px;font-weight:700">一个人一辈子读的书</div>`,
        { left: 96, top: 1260, color: 'var(--cream)' },
      )
      s.bookLbl2 = put(root, 'abs', '模型读过的文字', {
        left: 0,
        top: 330,
        width: 1080,
        textAlign: 'center',
        fontSize: 64,
        fontWeight: '900',
        color: A,
        textShadow: '0 4px 30px rgba(0,0,0,0.9)',
      })
      return s
    },
    render(s, lt, c) {
      const A = '#ffb000'
      // --- attention
      const aOut = c.L(2) - 0.2
      rise(s.paper, lt, 0.3, { dur: 0.6, dist: 30 })
      away(s.paper, lt, aOut, { dur: 0.3 })
      sfx('page', 0.3)
      s.tokEls.forEach((el, i) => {
        rise(el, lt, c.W(0, 'Transformer') + i * 0.07, { dur: 0.35, dist: 16 })
        away(el, lt, aOut, { dur: 0.3 })
      })
      const focus = 5
      const att = [0.62, 0.08, 0.12, 0.01, 0.05, 0, 0.08, 0.04]
      const aT = c.W(1, '注意') - 0.3
      const allT = c.W(1, '所有其他')
      const ap = ease.out(prog(lt, aT, 0.6))
      const allP = ease.out(prog(lt, allT, 0.8))
      const fadeA = 1 - prog(lt, aOut, 0.3)
      const ctx = s.actx
      ctx.clearRect(0, 0, 1080, 1920)
      const x0 = 150 + 150
      const arc = (i, j, alpha, width, color) => {
        const y1 = s.tokY[i]
        const y2 = s.tokY[j]
        const r = Math.abs(y2 - y1) / 2
        ctx.strokeStyle = color
        ctx.globalAlpha = alpha
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.ellipse(x0 + 40, (y1 + y2) / 2, r * 1.3 + 60, r, 0, -Math.PI / 2, Math.PI / 2)
        ctx.stroke()
      }
      if (allP > 0)
        for (let i = 0; i < 8; i++)
          for (let j = i + 1; j < 8; j++) if (i !== focus && j !== focus) arc(i, j, 0.12 * allP * fadeA, 2, '#f2efe6')
      if (ap > 0)
        att.forEach((w, j) => {
          if (j === focus) return
          arc(Math.min(j, focus), Math.max(j, focus), (0.25 + w) * ap * fadeA, 2 + w * 22, A)
        })
      ctx.globalAlpha = 1
      s.tokEls.forEach((el, i) => {
        const hi = i === focus ? ap : i === 0 ? ap * 0.9 : 0
        el.style.borderColor = hi > 0.3 ? A : 'rgba(242,239,230,0.35)'
        el.style.color = hi > 0.3 ? A : 'var(--cream)'
      })
      fade(s.attLbl, lt, aT + 0.3, 0.3)
      away(s.attLbl, lt, aOut, { dur: 0.3 })
      sfx('ping', aT)

      // --- scale up + next word
      const bIn = c.L(2) - 0.1
      const bOut = c.L(3) - 0.2
      const bOn = lt >= bIn && lt < bOut + 0.4
      s.stream.style.visibility = bOn ? 'inherit' : 'hidden'
      s.model.style.visibility = bOn ? 'inherit' : 'hidden'
      s.pred.style.visibility = bOn ? 'inherit' : 'hidden'
      const bFade = (1 - prog(lt, bOut, 0.3)) * prog(lt, bIn, 0.3)
      s.stream.style.opacity = bFade.toFixed(3)
      s.model.style.opacity = bFade.toFixed(3)
      s.model.style.transform = `scale(${(1 + 0.04 * Math.sin(lt * 10)).toFixed(3)})`
      s.streamLines.forEach((el, i) => {
        const sp = 280 + hash(i, 7) * 200
        const y = ((lt - bIn) * sp + hash(i, 8) * 560) % 560
        el.style.transform = `translate3d(0, ${(y - 60).toFixed(1)}px, 0) scale(${lerp(1, 0.6, y / 560).toFixed(3)})`
      })
      sfx('stream', bIn, { dur: 2.5 })
      const pIn = c.W(2, '预测') - 0.4
      s.pred.style.opacity = ((1 - prog(lt, bOut, 0.3)) * prog(lt, pIn, 0.3)).toFixed(3)
      const chosen = lt >= c.W(2, '下一个词') + 0.2
      s.pr.innerHTML = `机器能思考<span style="color:${A}">${chosen ? '吗' : '▌'}</span>`
      s.cands.forEach((el, i) => {
        const bar = el.querySelector('i')
        bar.style.transform = `scaleX(${ease.out(prog(lt, pIn + 0.2 + i * 0.08, 0.5)).toFixed(4)})`
        el.style.opacity = chosen && i > 0 ? '0.35' : '1'
      })
      sfx('ding', c.W(2, '下一个词') + 0.2)

      // --- ChatGPT
      const cIn = c.L(3) - 0.1
      const cOut = c.L(4) - 0.2
      const cOn = lt >= cIn && lt < cOut + 0.4
      s.chat.style.visibility = cOn ? 'inherit' : 'hidden'
      s.users.style.visibility = cOn ? 'inherit' : 'hidden'
      rise(s.chat, lt, cIn, { dur: 0.4, dist: 20 })
      away(s.chat, lt, cOut, { dur: 0.3 })
      typeText(s.ans, '写代码、查资料、翻译、陪你想点子……我可以试试。', lt, cIn + 0.6, 16, '▌')
      sfx('typing', cIn + 0.6, { dur: 1.8 })
      rise(s.users, lt, c.W(3, '两个月') - 0.4, { dur: 0.4, dist: 20 })
      away(s.users, lt, cOut, { dur: 0.3 })
      s.ubars.forEach((b, i) => {
        b.style.transform = `scaleX(${ease.out(prog(lt, c.W(3, '两个月') - 0.3 + i * 0.2, 0.5)).toFixed(4)})`
      })

      // --- books
      const dIn = c.L(4) - 0.1
      const bctx = s.bctx
      bctx.clearRect(0, 0, 1080, 1920)
      if (lt >= dIn) {
        // One person's lifetime shelf (3 rows), then zoom out to reveal the
        // wall of text the model read, with that shelf lost in the middle.
        const zoom = ease.inOut(prog(lt, c.W(4, '比任何人') - 0.2, 2.2))
        const sc = lerp(1, 0.03, zoom)
        const cx = lerp(256, 540, zoom)
        const cy = lerp(1160, 900, zoom)
        const SW = 330
        const SH = 60
        const reachX = Math.ceil(600 / (SW * sc)) + 1
        const reachY = Math.ceil(1100 / (SH * sc)) + 1
        bctx.save()
        bctx.translate(cx, cy)
        bctx.scale(sc, sc)
        for (let gy = -reachY; gy <= reachY; gy++)
          for (let gx = -reachX; gx <= reachX; gx++) {
            const own = gx === 0 && gy >= -1 && gy <= 1
            if (!own && zoom <= 0.01) continue
            const ox = gx * SW - 160
            const oy = gy * SH
            if (!own && sc < 0.06) {
              // Far away: one block per shelf is enough.
              bctx.fillStyle = `hsl(${(30 + hash(gx, gy) * 30) | 0},22%,${(24 + hash(gy, gx) * 12) | 0}%)`
              bctx.fillRect(ox, oy - 50, SW - 10, 52)
              continue
            }
            for (let k = 0; k < 16; k++) {
              const h = hash(gx, gy, k)
              bctx.fillStyle = own ? `hsl(${(h * 360) | 0},60%,58%)` : `hsl(${(30 + h * 30) | 0},22%,${(24 + h * 12) | 0}%)`
              bctx.fillRect(ox + k * 20, oy - 50 - h * 8, 17, 50 + h * 8)
            }
          }
        bctx.restore()
        // Keep the lifetime shelf findable: an amber box in screen space.
        const bw = Math.max(18, 330 * sc)
        const bh = Math.max(12, 180 * sc)
        bctx.strokeStyle = A
        bctx.lineWidth = 4
        bctx.strokeRect(cx - 160 * sc - (bw - 330 * sc) / 2 - 6, cy - 110 * sc - (bh - 180 * sc) / 2 - 6, bw + 12, bh + 12)
        if (zoom > 0.9) {
          bctx.fillStyle = 'rgba(14,14,12,0.85)'
          bctx.fillRect(cx - 170, cy + 40, 340, 64)
          bctx.fillStyle = '#f2efe6'
          bctx.font = '700 34px "Noto Sans SC"'
          bctx.textAlign = 'center'
          bctx.fillText('↑ 一个人一辈子', cx, cy + 84)
          bctx.textAlign = 'left'
        }
      }
      fade(s.bookLbl, lt, dIn, 0.3)
      away(s.bookLbl, lt, c.W(4, '比任何人'), { dur: 0.3 })
      fade(s.bookLbl2, lt, c.W(4, '都多') - 0.5, 0.4)
      sfx('whoosh', c.W(4, '比任何人') - 0.2)
    },
  },

  // ================================================================ 2026 现在
  finale: {
    wipe: '#ffffff',
    year: (lt, c) => {
      if (lt < c.L(3) - 0.2) return 2026
      if (lt < c.L(4) - 0.2) return 1936
      if (lt < c.L(6)) return 2026
      return '20??'
    },
    engine: (lt, c) => (lt < c.W(6, '由你') ? '语言模型' : '你'),
    build(root, c) {
      const s = {}
      root.style.background = '#0e0e0c'
      const A = 'var(--amber)'
      // --- A: capabilities
      s.caps = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      const panel = (title, top, html) =>
        put(
          s.caps,
          'abs',
          `<div style="font-family:var(--grot);font-size:28px;color:${A};margin-bottom:12px">${title}</div>${html}`,
          { left: 96, top, width: 888, height: 300, padding: '26px 30px', borderRadius: '18px', border: '2px solid rgba(242,239,230,.2)', background: '#15140f', color: 'var(--cream)', overflow: 'hidden' },
        )
      s.code = panel('写代码', 320, `<pre class="cd" style="font-family:var(--code);font-size:32px;line-height:1.45;white-space:pre"></pre>`)
      s.paint = panel('画画', 650, '')
      s.pcv = canvas(s.paint, 828, 220, { left: 30, top: 70, borderRadius: '10px' })
      s.pctx = s.pcv.getContext('2d')
      s.voice = panel('听懂你说的话', 980, `<div class="wave" style="display:flex;align-items:center;gap:8px;height:120px"></div><div class="tr" style="font-size:40px;font-weight:700;margin-top:10px"></div>`)
      s.wave = $('.wave', s.voice)
      s.tr = $('.tr', s.voice)
      s.bars = Array.from({ length: 46 }, () => {
        const b = document.createElement('i')
        b.style.cssText = `display:block;width:10px;border-radius:5px;background:${'#ffb000'}`
        s.wave.appendChild(b)
        return b
      })
      s.cd = $('.cd', s.code)

      // --- B: decomposition
      s.dec = put(root, 'abs', '', { left: 0, top: 0, width: 1080, height: 1920 })
      s.word = put(s.dec, 'abs center', '你好', { left: 0, top: 360, width: 1080, height: 240, fontSize: 200, fontWeight: '900', color: 'var(--cream)' })
      s.tok = put(s.dec, 'abs center', '', { left: 0, top: 640, width: 1080, height: 120, fontFamily: 'var(--code)', fontSize: 60, color: A })
      s.bin = put(s.dec, 'abs center', '', { left: 0, top: 800, width: 1080, height: 110, fontFamily: 'var(--code)', fontSize: 58, letterSpacing: '0.08em', color: 'var(--cream)' })
      s.swGrid = put(s.dec, 'abs', '', { left: 116, top: 960, width: 848, height: 300 })
      s.bits = '0110001011110101'
      s.sws = [...s.bits].map((b, i) =>
        put(
          s.swGrid,
          'abs',
          `<svg width="80" height="130" viewBox="-40 -65 80 130"><rect x="-26" y="-56" width="52" height="112" rx="26" fill="none" stroke="#f2efe6" stroke-width="4"/><circle class="k" r="19" cy="${b === '1' ? -28 : 28}" fill="${b === '1' ? '#ffb000' : '#f2efe6'}"/></svg>`,
          { left: (i % 8) * 106, top: Math.floor(i / 8) * 150 },
        ),
      )
      s.note = put(s.dec, 'abs', '编号与编码为示意', { left: 96, top: 1300, fontSize: 24, color: 'var(--cream)', opacity: '0.45' })

      // --- C/D: the one switch (same drawing as the opening)
      s.one = put(
        root,
        'abs',
        `<svg width="280" height="460" viewBox="-140 -230 280 460">
           <rect x="-100" y="-200" width="200" height="400" rx="100" fill="none" stroke="#fff" stroke-width="7"/>
           <rect class="fl" x="-100" y="-200" width="200" height="400" rx="100" fill="#fff" opacity="0"/>
           <circle class="kn" r="76" fill="#fff"/>
         </svg>`,
        { left: 400, top: 490 },
      )
      s.oneFill = $('.fl', s.one)
      s.oneKnob = $('.kn', s.one)

      // --- E: a field of switches
      s.field = canvas(root, 1080, 1920)
      s.fctx = s.field.getContext('2d')

      // --- F/G: the question, the answer box, the end card
      s.q = put(
        root,
        'abs',
        `<div style="font-family:var(--hand);font-weight:700;font-size:130px;line-height:1.25">机器，<br>能思考吗？</div>
         <div style="margin-top:24px;font-family:var(--hand);font-size:40px;opacity:.7">— 图灵，1950</div>`,
        { left: 110, top: 420, width: 900, color: 'var(--cream)' },
      )
      s.box = put(
        root,
        'abs',
        `<div style="font-family:var(--grot);font-size:30px;opacity:.6;margin-bottom:14px">你的答案</div>
         <div style="height:130px;border:3px solid var(--amber);border-radius:18px;display:flex;align-items:center;padding:0 34px;font-size:52px"><span class="cur" style="color:var(--amber)">▌</span></div>`,
        { left: 110, top: 1010, width: 860, color: 'var(--cream)' },
      )
      s.cur = $('.cur', s.box)
      s.end = put(
        root,
        'abs',
        `<div style="font-family:'Noto Sans SC';font-weight:900;font-size:64px;letter-spacing:.06em">开关的觉醒</div>
         <div style="margin-top:10px;font-family:var(--grot);font-size:30px;opacity:.6;letter-spacing:.3em">1936 → 2026 → ?</div>`,
        { left: 110, top: 1250, color: 'var(--cream)' },
      )
      return s
    },
    render(s, lt, c) {
      const A = '#ffb000'
      // --- A
      const aOut = c.L(1) - 0.2
      s.caps.style.visibility = lt < aOut + 0.4 ? 'inherit' : 'hidden'
      s.caps.style.opacity = (1 - prog(lt, aOut, 0.3)).toFixed(3)
      rise(s.code, lt, c.W(0, '写代码') - 0.3, { dur: 0.4, dist: 20 })
      rise(s.paint, lt, c.W(0, '画画') - 0.3, { dur: 0.4, dist: 20 })
      rise(s.voice, lt, c.W(0, '听懂') - 0.3, { dur: 0.4, dist: 20 })
      typeText(s.cd, 'def hello():\n    print("你好，世界")', lt, c.W(0, '写代码') - 0.1, 30)
      sfx('typing', c.W(0, '写代码') - 0.1, { dur: 1.2 })
      // A painting resolving from noise into a sunset.
      const pctx = s.pctx
      const pr = ease.out(prog(lt, c.W(0, '画画') - 0.1, 1.6))
      const sky = pctx.createLinearGradient(0, 0, 0, 220)
      sky.addColorStop(0, '#2a1a4a')
      sky.addColorStop(0.6, '#ff7a45')
      sky.addColorStop(1, '#ffd166')
      pctx.fillStyle = sky
      pctx.fillRect(0, 0, 828, 220)
      pctx.fillStyle = '#fff3c4'
      pctx.beginPath()
      pctx.arc(560, 150, 46, 0, TAU)
      pctx.fill()
      pctx.fillStyle = '#1b1530'
      pctx.beginPath()
      pctx.moveTo(0, 220)
      for (let x = 0; x <= 828; x += 12) pctx.lineTo(x, 170 - Math.sin(x / 90) * 30 - Math.sin(x / 31) * 8)
      pctx.lineTo(828, 220)
      pctx.fill()
      // Noise on top that clears as the “diffusion” resolves.
      for (let k = 0; k < 900 * (1 - pr); k++) {
        pctx.fillStyle = `hsl(${(hash(k, Math.floor(lt * 12)) * 360) | 0},60%,55%)`
        pctx.fillRect(hash(k, 1, Math.floor(lt * 12)) * 828, hash(k, 2, Math.floor(lt * 12)) * 220, 14, 14)
      }
      s.bars.forEach((b, i) => {
        const on = prog(lt, c.W(0, '听懂') - 0.1, 0.2)
        const h = 12 + on * 100 * Math.abs(Math.sin(i * 0.7 + lt * 9) * noise1(i * 0.3 + lt * 4, 2))
        b.style.height = `${h.toFixed(1)}px`
      })
      typeText(s.tr, '“帮我订明早八点的闹钟”', lt, c.W(0, '听懂') + 0.3, 14)

      // --- B: 你好 → token → bits → switches
      const bIn = c.L(1) - 0.1
      const bOut = c.L(2) + 0.3
      s.dec.style.visibility = lt >= bIn && lt < bOut + 0.6 ? 'inherit' : 'hidden'
      s.dec.style.opacity = (prog(lt, bIn, 0.3) * (1 - prog(lt, bOut, 0.4))).toFixed(3)
      pop(s.word, lt, bIn, { dur: 0.4, from: 0.8 })
      const tT = c.W(1, '文字变成数字')
      s.tok.textContent = lt >= tT ? '“你好” → #25065' : ''
      s.tok.style.opacity = prog(lt, tT, 0.3).toFixed(3)
      const bT = c.W(1, '数字变成比特')
      const bp = prog(lt, bT, 0.8)
      s.bin.textContent = s.bits.slice(0, Math.ceil(bp * 16))
      s.note.style.opacity = (0.45 * prog(lt, tT, 0.3)).toFixed(3)
      s.sws.forEach((el, i) => pop(el, lt, c.L(2) - 0.3 + i * 0.04, { dur: 0.3, from: 0.4 }))
      sfx('ping', tT)
      sfx('counter', bT, { dur: 0.8 })
      for (let i = 0; i < 16; i += 2) sfx('click', c.L(2) - 0.3 + i * 0.04)

      // --- C/D: zoom into one switch; ninety years ago it could only flip
      const oneIn = c.L(2) + 0.4
      const oneOut = c.L(4) + 0.3
      s.one.style.visibility = lt >= oneIn - 0.2 && lt < oneOut + 0.8 ? 'inherit' : 'hidden'
      const zi = ease.out(prog(lt, oneIn - 0.2, 0.6))
      const f = flips(lt, { initial: 1, list: [[c.W(3, '开和关') - 0.1, 0], [c.W(3, '关') + 0.05, 1]] })
      sfx('click', c.W(3, '开和关') - 0.1)
      sfx('click', c.W(3, '关') + 0.05)
      s.oneKnob.setAttribute('cy', lerp(120, -120, f.x).toFixed(2))
      s.oneKnob.setAttribute('fill', f.v ? '#000' : '#fff')
      s.oneFill.setAttribute('opacity', (f.v ? ease.out(f.p) : 1 - ease.out(f.p)).toFixed(3))
      const shrink = ease.inOut(prog(lt, c.L(4) - 0.1, 1.0))
      s.one.style.opacity = (zi * (1 - shrink)).toFixed(3)
      s.one.style.transform = `scale(${(lerp(0.3, 1, zi) * lerp(1, 0.04, shrink)).toFixed(4)})`

      // --- E: the field of switches, lighting up as a speech bubble
      const ctx = s.fctx
      ctx.clearRect(0, 0, 1080, 1920)
      const eIn = c.L(4) - 0.1
      const eOut = c.L(5) - 0.2
      if (lt >= eIn && lt < eOut + 0.6) {
        const grow = ease.out(prog(lt, eIn + 0.3, 1.6))
        const fadeOut = 1 - prog(lt, eOut, 0.5)
        const gap = lerp(80, 14, grow)
        const bubble = (x, y) => {
          const dx = (x - 540) / 380
          const dy = (y - 820) / 260
          const inBody = dx * dx + dy * dy < 1
          const inTail = y > 1000 && y < 1180 && x > 330 && x < 460 && x - 330 < (1180 - y) * 0.75
          return inBody || inTail
        }
        const wave = prog(lt, c.W(4, '学会了'), 1.2)
        for (let y = 820 - Math.floor(900 / gap) * gap; y < 1920; y += gap)
          for (let x = 540 - Math.floor(540 / gap) * gap; x < 1080; x += gap) {
            const d = Math.hypot(x - 540, y - 820)
            if (d > grow * 1400) continue
            const inside = bubble(x, y)
            const flick = hash(Math.round(x), Math.round(y), Math.floor(lt * 8)) > 0.5
            const lit = inside ? clamp(wave * 2 - d / 800) : 0
            const a = (flick ? 0.55 : 0.2) * (1 - lit) + lit
            ctx.fillStyle = lit > 0.3 ? A : '#f2efe6'
            ctx.globalAlpha = a * fadeOut
            const r = lerp(3, 1.6, grow) + lit * 1.5
            ctx.fillRect(x - r, y - r, r * 2, r * 2)
          }
        ctx.globalAlpha = 1
      }
      sfx('swell', eIn + 0.3)
      sfx('chord', c.W(4, '学会了'))

      // --- F/G
      const qIn = c.L(5) - 0.1
      s.q.style.visibility = lt >= qIn ? 'inherit' : 'hidden'
      const w = ease.out(prog(lt, qIn, 1.4))
      s.q.style.clipPath = `inset(-10% ${((1 - w) * 100).toFixed(2)}% -10% 0)`
      sfx('pencil', qIn, { dur: 1.4 })
      rise(s.box, lt, c.L(6) - 0.1, { dur: 0.5, dist: 20 })
      s.cur.style.opacity = Math.floor(lt * 2) % 2 === 0 ? '1' : '0'
      rise(s.end, lt, c.E(6) + 0.6, { dur: 0.8, dist: 20 })
      sfx('end', c.E(6) + 0.6)
    },
  },
}

// ---------------------------------------------------------------- helpers

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

function drawPC(ctx, x, y, blink) {
  // Desk.
  ctx.fillStyle = P8.brown
  ctx.fillRect(x - 30, y + 96, 160, 6)
  ctx.fillRect(x - 24, y + 102, 4, 40)
  ctx.fillRect(x + 120, y + 102, 4, 40)
  // Monitor.
  ctx.fillStyle = P8.peach
  ctx.fillRect(x, y, 100, 76)
  ctx.fillStyle = P8.black
  ctx.fillRect(x + 6, y + 6, 88, 58)
  pixelText(ctx, 'READY.', x + 10, y + 10, P8.lime, 8)
  pixelText(ctx, ']', x + 10, y + 22, P8.lime, 8)
  if (blink) {
    ctx.fillStyle = P8.lime
    ctx.fillRect(x + 17, y + 24, 5, 8)
  }
  ctx.fillStyle = P8.lgray
  ctx.fillRect(x + 36, y + 76, 28, 6)
  // Keyboard.
  ctx.fillStyle = P8.peach
  ctx.fillRect(x + 4, y + 84, 92, 12)
  ctx.fillStyle = P8.dgray
  for (let i = 0; i < 10; i++) ctx.fillRect(x + 8 + i * 9, y + 87, 6, 3)
  for (let i = 0; i < 9; i++) ctx.fillRect(x + 12 + i * 9, y + 91, 6, 3)
  // Floppy drive.
  ctx.fillStyle = P8.lgray
  ctx.fillRect(x + 104, y + 60, 26, 36)
  ctx.fillStyle = P8.black
  ctx.fillRect(x + 108, y + 70, 18, 2)
}

function drawDesk(ctx, x, y, p, blink) {
  // Tiny person at a tiny computer (16 × 14 px).
  ctx.fillStyle = P8.peach
  ctx.fillRect(x + 6, y, 10, 8)
  ctx.fillStyle = P8.black
  ctx.fillRect(x + 7, y + 1, 8, 5)
  ctx.fillStyle = blink ? P8.lime : P8.green
  ctx.fillRect(x + 8, y + 2, 4, 1)
  ctx.fillStyle = p.skin
  ctx.fillRect(x, y + 2, 4, 4)
  ctx.fillStyle = p.shirt
  ctx.fillRect(x - 1, y + 6, 6, 6)
  ctx.fillStyle = P8.brown
  ctx.fillRect(x - 2, y + 12, 20, 2)
}
