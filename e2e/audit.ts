// The checks, run inside the page on whatever is on screen right now.
// Each returns plain-English problems; an empty list means the screen passes.
import { inflateSync } from 'node:zlib'

export interface AuditOptions {
  theme: 'sun' | 'dark' | 'night'
  /** Contrast minimum for Sun/Dark (owner's rule: 4.5). */
  minContrast: number
  /** Night text must be pure red: 5.25:1 on black. */
  nightContrast: number
  /** Style guide shows all three themes at once, so skip theme-wide colour checks there. */
  mixedThemes: boolean
}

export interface Finding {
  kind: 'target-size' | 'target-gap' | 'overlap' | 'inline-link' | 'contrast' | 'night-colour' | 'overflow' | 'text-size' | 'hold-size'
  detail: string
}

/** Runs in the browser. Must not use anything from outside its own body. */
export function auditInPage(o: AuditOptions): Finding[] {
  const out: Finding[] = []
  const html = document.documentElement
  const vw = html.clientWidth

  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden], [aria-hidden="true"]')
  }
  const name = (el: Element) => {
    const t = (el.textContent || (el as HTMLInputElement).name || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')
    return `${el.tagName.toLowerCase()}${el.classList.length ? '.' + [...el.classList].join('.') : ''} "${t.slice(0, 30)}"`
  }
  const directText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())

  // ---- Overflow ----
  if (html.scrollWidth > vw + 1) out.push({ kind: 'overflow', detail: `page is ${html.scrollWidth}px wide on a ${vw}px screen` })
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || el.closest('svg')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) out.push({ kind: 'overflow', detail: `${name(el)} runs off the screen (${Math.round(r.left)}–${Math.round(r.right)}px)` })
  }

  // ---- Tap targets ----
  const targets = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, summary, textarea')].filter(visible)
  const isInline = (el: Element) => el.tagName === 'A' && !el.classList.contains('btn') && el.parentElement !== null && directText(el.parentElement)
  for (const el of targets) {
    // offsetWidth ignores rotation (the round clock dial), so it's the real size.
    const w = (el as HTMLElement).offsetWidth
    const h = (el as HTMLElement).offsetHeight
    if (w < 47.5 || h < 47.5) {
      if (isInline(el)) out.push({ kind: 'inline-link', detail: `${name(el)} is a link inside a sentence, ${w}×${h}px` })
      else out.push({ kind: 'target-size', detail: `${name(el)} is ${w}×${h}px (needs 48×48)` })
    }
  }
  // Spacing and overlap: only between targets a finger can actually reach right
  // now (fully on screen and on top — not hidden under a sheet or scrolled under
  // the tab bar). Scroll through the page (or the open sheet) so every part is seen.
  const reachable = () =>
    targets
      .filter((el) => !isInline(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => {
        if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > vw) return false
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return !!hit && (el === hit || el.contains(hit) || (hit.closest('label') !== null && hit.closest('label') === el.closest('label')))
      })
  const scroller: { top: number; height: number; view: number; to: (y: number) => void } = (() => {
    const sheet = document.querySelector<HTMLElement>('.sheet')
    if (sheet) return { top: sheet.scrollTop, height: sheet.scrollHeight, view: sheet.clientHeight, to: (y) => (sheet.scrollTop = y) }
    return { top: scrollY, height: html.scrollHeight, view: innerHeight, to: (y) => scrollTo(0, y) }
  })()
  const seen = new Set<string>()
  const pairs: { a: Element; b: Element; ra: DOMRect; rb: DOMRect }[] = []
  for (let y = 0; ; y += Math.max(100, Math.floor(scroller.view / 2))) {
    scroller.to(y)
    const boxes = reachable()
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) pairs.push({ a: boxes[i].el, b: boxes[j].el, ra: boxes[i].r, rb: boxes[j].r })
    if (y + scroller.view >= scroller.height) break
  }
  scroller.to(scroller.top)
  const boxes = [] as { el: Element; r: DOMRect }[]
  for (const p of pairs) {
    const key = `${name(p.a)}|${name(p.b)}`
    if (seen.has(key)) continue
    seen.add(key)
    boxes.length = 0
    boxes.push({ el: p.a, r: p.ra }, { el: p.b, r: p.rb })
    checkPair(0, 1)
  }
  function checkPair(i: number, j: number) {
    const a = boxes[i]
    const b = boxes[j]
    if (a.el.contains(b.el) || b.el.contains(a.el)) return
    // A checkbox inside its own big label counts as one target.
    if (a.el.closest('label') && a.el.closest('label') === b.el.closest('label')) return
    // Page content scrolls past the fixed tab bar, so only things that stay put
    // next to it (fixed or sticky bars) can crowd it.
    const pinned = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) if (/fixed|sticky/.test(getComputedStyle(e).position)) return true
      return false
    }
    const inTabbar = (el: Element) => el.closest('.tabbar') !== null
    if (inTabbar(a.el) !== inTabbar(b.el) && !pinned(inTabbar(a.el) ? b.el : a.el)) return
    // Scrolling content that slides under a pinned bar can only be tapped where it
    // still shows, so measure its visible part only.
    const pinnedBox = (el: Element) => {
      let box: DOMRect | undefined
      for (let e: Element | null = el; e; e = e.parentElement) if (/fixed|sticky/.test(getComputedStyle(e).position)) box = e.getBoundingClientRect()
      return box
    }
    for (const [p, s] of [[a, b], [b, a]] as const) {
      if (!pinned(p.el) || pinned(s.el)) continue
      const box = pinnedBox(p.el)!
      const r = s.r
      const top = r.top < box.top && r.bottom > box.top ? r.top : r.top < box.bottom && r.bottom > box.bottom ? box.bottom : r.top
      const bottom = r.top < box.top && r.bottom > box.top ? box.top : r.bottom
      if (bottom - top < 1) return // fully hidden under the bar
      s.r = new DOMRect(r.left, top, r.width, bottom - top)
    }
    // Round buttons (the clock dial) only react inside the circle.
    const round = (el: Element) => getComputedStyle(el).borderRadius.startsWith('50%')
    let dx: number
    let dy: number
    let gap: number
    if (round(a.el) && round(b.el)) {
      const d = Math.hypot(a.r.left + a.r.width / 2 - (b.r.left + b.r.width / 2), a.r.top + a.r.height / 2 - (b.r.top + b.r.height / 2))
      gap = d - a.r.width / 2 - b.r.width / 2
      dx = dy = gap
    } else {
      dx = Math.max(b.r.left - a.r.right, a.r.left - b.r.right)
      dy = Math.max(b.r.top - a.r.bottom, a.r.top - b.r.bottom)
      gap = Math.max(dx, dy)
    }
    if (dx < -1 && dy < -1) out.push({ kind: 'overlap', detail: `${name(a.el)} overlaps ${name(b.el)}` })
    else if (gap >= -1 && gap < 7.5) out.push({ kind: 'target-gap', detail: `${name(a.el)} and ${name(b.el)} are ${Math.max(0, Math.round(gap))}px apart (needs 8)` })
  }

  // ---- Text size and contrast ----
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = (c: { r: number; g: number; b: number }) => {
    const ch = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
  }
  const over = (top: { r: number; g: number; b: number; a: number }, under: { r: number; g: number; b: number }) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
  })
  /** The colour actually behind an element: its own background, else its parents'. */
  const background = (el: Element) => {
    const layers: { r: number; g: number; b: number; a: number }[] = []
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c && c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
    }
    let base = { r: 255, g: 255, b: 255 }
    for (const l of layers.reverse()) base = over(l, base)
    return base
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || !directText(el) || el.closest('.print-area')) continue
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    const field = el.closest('.field-screen') !== null
    const min = field ? 18 : 16
    if (size < min - 0.1) out.push({ kind: 'text-size', detail: `${name(el)} is ${size}px (needs ${min}px${field ? ' on a field screen' : ''})` })
    const fg = parse(el.closest('svg') ? cs.fill : cs.color)
    if (!fg) continue
    const disabled = el.closest('button:disabled, input:disabled, select:disabled, [aria-disabled="true"]') !== null
    const bg = background(el)
    const text = over(fg, bg)
    const L1 = lum(text)
    const L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const panelTheme = (el.closest('[data-theme]') as HTMLElement | null)?.dataset.theme ?? o.theme
    const need = panelTheme === 'night' ? o.nightContrast : o.minContrast
    if (ratio < need - 0.01 && !disabled) out.push({ kind: 'contrast', detail: `${name(el)} contrast ${ratio.toFixed(2)}:1 (needs ${need}:1)` })
    let op = 1
    for (let e: Element | null = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity)
    if (op < 1 && !disabled) out.push({ kind: 'contrast', detail: `${name(el)} is drawn see-through (opacity ${op.toFixed(2)})` })
  }

  // ---- Night: no green or blue in any colour on screen ----
  if (o.theme === 'night' && !o.mixedThemes) {
    for (const el of document.body.querySelectorAll('*')) {
      if (!visible(el)) continue
      const cs = getComputedStyle(el)
      const props: [string, string][] = [
        ['text', cs.color],
        ['background', cs.backgroundColor],
        ...(parseFloat(cs.borderTopWidth) > 0 ? ([['border', cs.borderTopColor]] as [string, string][]) : []),
        ...(cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? ([['outline', cs.outlineColor]] as [string, string][]) : []),
        ...(el.closest('svg') ? ([['fill', cs.fill], ['stroke', cs.stroke]] as [string, string][]) : []),
      ]
      for (const [what, value] of props) {
        const c = parse(value)
        if (c && c.a > 0 && (c.g > 0 || c.b > 0)) out.push({ kind: 'night-colour', detail: `${name(el)} ${what} is ${value}` })
      }
    }
  }

  // ---- Hold numbers on Shoot ----
  for (const el of document.querySelectorAll('#page .readout-num')) {
    if (!visible(el)) continue
    const size = parseFloat(getComputedStyle(el).fontSize)
    if (size < 71.9) out.push({ kind: 'hold-size', detail: `hold number "${el.textContent}" is ${size}px (needs 72px)` })
  }
  return out
}

/**
 * Night check on the actual picture (catches things styles can't show, like a
 * native checkbox drawn white): any pixel with green or blue in it.
 * Returns how many such pixels there are and one example.
 */
export function greenOrBluePixels(png: Buffer): { count: number; example?: string } {
  // Minimal PNG reader (8-bit RGB/RGBA, as Playwright writes them).
  let pos = 8
  let width = 0
  let height = 0
  let channels = 4
  const idat: Buffer[] = []
  while (pos < png.length) {
    const len = png.readUInt32BE(pos)
    const type = png.toString('ascii', pos + 4, pos + 8)
    const data = png.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      channels = data[9] === 6 ? 4 : 3
    } else if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const prev = Buffer.alloc(stride)
  const line = Buffer.alloc(stride)
  let count = 0
  let example: string | undefined
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[x] = v & 255
    }
    for (let x = 0; x < width; x++) {
      const g = line[x * channels + 1]
      const bl = line[x * channels + 2]
      if (g > 0 || bl > 0) {
        count++
        example ??= `pixel ${x},${y} = rgb(${line[x * channels]}, ${g}, ${bl})`
      }
    }
    line.copy(prev)
  }
  return { count, example }
}
