// The app's reusable components. Each returns plain HTML using the classes in
// components.css (all colours/sizes from tokens.css). Screens wire up clicks
// with the data-* attributes these put on their buttons.
//
// Rules (see CLAUDE.md "Design system"): every tap target >= 48px with 8px gaps,
// primary controls use --control-primary (96px in Glove mode), instant pressed
// state, nothing animates longer than 150ms.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export interface Option {
  value: string
  label: string
}

/** Big read-out: label, direction, huge number, unit. E.g. ELEV · UP · 4.6 · MIL. */
export function readout(o: { id: string; label: string; dir?: string; value?: string; unit?: string; tone?: 'elev' | 'wind' }): string {
  const len = (o.value ?? '').length
  const long = len > 4 ? ' data-long' : ''
  const tone = o.tone ? ` tone-${o.tone}` : ''
  return `<div class="readout${tone}" data-readout="${esc(o.id)}" data-len="${len}"${long}>
    <span class="readout-label" data-part="label">${esc(o.label)}</span>
    <span class="readout-dir" data-part="dir">${esc(o.dir ?? '')}</span>
    <span class="readout-num" data-part="num">${esc(o.value ?? '…')}</span>
    <span class="readout-unit" data-part="unit">${esc(o.unit ?? '')}</span>
  </div>`
}

/**
 * Two read-outs side by side in one card (e.g. ELEV and WIND). If either value
 * is too long to fit side by side at the 72px minimum (4+ characters, like
 * 12.4 or 143.1), the pair stacks automatically instead of shrinking.
 */
export function readoutPair(a: string, b: string): string {
  return `<div class="readout-pair side" aria-live="polite">${a}${b}</div>`
}

/** Updates a readout made by readout() in place (no re-render, so no flicker). */
export function setReadout(root: ParentNode, id: string, v: { label?: string; dir?: string; value?: string; unit?: string }): void {
  const el = root.querySelector(`[data-readout="${id}"]`)
  if (!el) return
  for (const part of ['label', 'dir', 'value', 'unit'] as const) {
    const key = part === 'value' ? 'num' : part
    if (v[part] !== undefined) el.querySelector(`[data-part="${key}"]`)!.textContent = v[part]!
  }
  if (v.value !== undefined) {
    el.toggleAttribute('data-long', v.value.length > 4)
    el.setAttribute('data-len', String(v.value.length)) // a side-by-side pair stacks when a value is 4+ characters
  }
}

/**
 * Big stepper: − value +. Buttons carry data-stepper="name" and data-dir="-1|1".
 * With `input`, the value is a text box you can type into (name = input name).
 */
export function stepper(o: {
  name: string
  label: string
  value: string
  unit?: string
  input?: boolean
  inputMode?: string
  /** Extra markup shown before the value (e.g. a wind arrow). Trusted HTML only. */
  prefixHtml?: string
  /** Button symbols; default − and +. */
  minus?: string
  plus?: string
  minusLabel?: string
  plusLabel?: string
}): string {
  const value = o.input
    ? `<input class="stepper-input" name="${esc(o.name)}" type="text" inputmode="${o.inputMode ?? 'numeric'}" autocomplete="off" value="${esc(o.value)}" aria-label="${esc(o.label)}" />`
    : `<strong class="stepper-text" data-stepper-value="${esc(o.name)}">${esc(o.value)}</strong>`
  return `<div class="stepper" role="group" aria-label="${esc(o.label)}">
    <button class="btn stepper-btn" type="button" data-stepper="${esc(o.name)}" data-dir="-1" aria-label="${esc(o.minusLabel ?? `${o.label} down`)}">${o.minus ?? '−'}</button>
    <label class="stepper-value">${o.prefixHtml ?? ''}${value}${o.unit ? `<span class="stepper-unit">${esc(o.unit)}</span>` : ''}</label>
    <button class="btn stepper-btn" type="button" data-stepper="${esc(o.name)}" data-dir="1" aria-label="${esc(o.plusLabel ?? `${o.label} up`)}">${o.plus ?? '+'}</button>
  </div>`
}

/** Row of small choices; the selected one is marked aria-pressed. Buttons carry data-chip="name" data-value. */
export function chipRow(o: { name: string; label: string; options: Option[]; selected: string }): string {
  return `<div class="chip-row" role="group" aria-label="${esc(o.label)}">
    ${o.options
      .map(
        (op) =>
          `<button class="btn chip" type="button" data-chip="${esc(o.name)}" data-value="${esc(op.value)}" aria-pressed="${op.value === o.selected}">${esc(op.label)}</button>`,
      )
      .join('')}
  </div>`
}

/** Segmented toggle (one of two or three), e.g. MIL | MOA. Buttons carry data-segment="name" data-value. */
export function segmented(o: { name: string; label: string; options: Option[]; selected: string }): string {
  return `<div class="segmented" role="group" aria-label="${esc(o.label)}">
    ${o.options
      .map(
        (op) =>
          `<button class="btn segment" type="button" data-segment="${esc(o.name)}" data-value="${esc(op.value)}" aria-pressed="${op.value === o.selected}">${esc(op.label)}</button>`,
      )
      .join('')}
  </div>`
}

/** Marks which button in a chip row / segmented toggle is selected, without re-rendering. */
export function setSelected(root: ParentNode, attr: 'data-chip' | 'data-segment', name: string, value: string): void {
  root.querySelectorAll<HTMLElement>(`[${attr}="${name}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)))
}

/** Arrow showing where the wind blows TO (wind from 3 o'clock travels toward 9). */
export function windArrowSvg(clock: number): string {
  const angle = clock * 30 + 180
  return `<svg class="wind-arrow" viewBox="-50 -50 100 100" aria-hidden="true">
    <g transform="rotate(${angle})">
      <line x1="0" y1="34" x2="0" y2="-24" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
      <path d="M -16 -16 L 0 -38 L 16 -16 Z" fill="currentColor" />
    </g></svg>`
}

/**
 * Clock dial: 12 tappable hours around a circle; the centre shows the arrow and
 * the chosen hour. Buttons carry data-clock="hour". In Glove mode (CSS) the same
 * buttons become a 4×4 clock-face grid of 96px buttons with the arrow in the middle.
 */
export function clockDial(o: { label: string; selected: number }): string {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  return `<div class="clock" role="group" aria-label="${esc(o.label)}">
    ${hours
      .map(
        (h) =>
          `<button class="btn clock-hour" type="button" data-clock="${h}" style="--i:${h % 12}" aria-pressed="${h === o.selected}" aria-label="${h} o'clock">${h}</button>`,
      )
      .join('')}
    <div class="clock-center" aria-live="polite"><span data-clock-arrow>${windArrowSvg(o.selected)}</span>
      <strong data-clock-value>${o.selected}</strong><span>o'clock</span></div>
  </div>`
}

/** Updates a clock dial in place. */
export function setClock(root: ParentNode, hour: number): void {
  root.querySelectorAll<HTMLElement>('[data-clock]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.clock) === hour)))
  const arrow = root.querySelector('[data-clock-arrow]')
  if (arrow) arrow.innerHTML = windArrowSvg(hour)
  const value = root.querySelector('[data-clock-value]')
  if (value) value.textContent = String(hour)
}

/**
 * Undo toast: a short message with an Undo button, just above the tab bar, for
 * a few seconds. The brief prefers Undo to "are you sure?" pop-ups.
 * Showing a new toast replaces any previous one.
 */
export function showUndoToast(o: { text: string; onUndo: () => void; ms?: number; theme?: string }): () => void {
  document.querySelector('.undo-toast')?.remove()
  const toast = document.createElement('div')
  toast.className = 'undo-toast'
  toast.setAttribute('role', 'status')
  if (o.theme) toast.dataset.theme = o.theme
  toast.innerHTML = `<p>${esc(o.text)}</p><button class="btn" type="button" data-undo>Undo</button>`
  document.body.append(toast)
  const close = () => {
    clearTimeout(timer)
    toast.remove()
  }
  const timer = setTimeout(close, o.ms ?? 5000)
  toast.querySelector('[data-undo]')!.addEventListener('click', () => {
    close()
    o.onUndo()
  })
  return close
}

/** Card: a flat, outlined box. */
export function card(content: string, o: { title?: string; className?: string } = {}): string {
  return `<section class="card${o.className ? ' ' + o.className : ''}">${o.title ? `<h2 class="card-title">${esc(o.title)}</h2>` : ''}${content}</section>`
}

export interface Tab {
  id: string
  label: string
  icon: string
}

/** Bottom tab bar (max 4 tabs). Links to #/id; the current one is aria-current="page". */
export function tabBar(tabs: Tab[], current: string): string {
  if (tabs.length > 4) throw new Error('The tab bar holds at most 4 tabs.')
  return `<nav class="tabbar" aria-label="Main">
    ${tabs
      .map(
        (t) =>
          `<a class="tab" href="#/${esc(t.id)}" data-tab="${esc(t.id)}"${t.id === current ? ' aria-current="page"' : ''}>
            <span class="tab-icon" aria-hidden="true">${t.icon}</span><span class="tab-label">${esc(t.label)}</span></a>`,
      )
      .join('')}
  </nav>`
}

export interface SheetHandle {
  /** The sheet's content area, to wire up its controls. */
  body: HTMLElement
  close: () => void
  /** Closes the sheet, then goes to another page (e.g. '#/data'). */
  closeAndGo: (hash: string) => void
}

/**
 * Bottom sheet: slides up from the bottom. Closes with ✕, tapping outside,
 * Escape, or the phone's back gesture. Keeps keyboard focus inside while open.
 * `theme` lets the style guide show a sheet in a specific theme; `field` gives it
 * field-screen text (18px) for sheets used on the line.
 */
export function openSheet(o: { title: string; content: string; onClose?: () => void; theme?: string; field?: boolean }): SheetHandle {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  if (o.theme) wrap.dataset.theme = o.theme
  wrap.innerHTML = `<section class="sheet${o.field ? ' field-screen' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <header class="sheet-head"><h2 class="sheet-title">${esc(o.title)}</h2>
        <button class="btn sheet-close" type="button" data-sheet-close aria-label="Close">✕</button></header>
      <div class="sheet-body">${o.content}</div>
    </section>`
  const opener = document.activeElement as HTMLElement | null
  document.body.append(wrap)
  document.body.classList.add('sheet-open')

  let closed = false
  const close = (fromBack = false) => {
    if (closed) return
    closed = true
    window.removeEventListener('popstate', onBack)
    document.removeEventListener('keydown', onKey)
    wrap.remove()
    if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('sheet-open')
    // Undo the history entry we added, unless the back gesture already did.
    if (!fromBack && history.state?.sheet) history.back()
    opener?.focus?.()
    o.onClose?.()
  }
  const onBack = () => close(true)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') trapFocus(e, wrap)
  }

  // The phone's back gesture closes the sheet instead of leaving the page.
  history.pushState({ sheet: true }, '', location.href)
  window.addEventListener('popstate', onBack)
  document.addEventListener('keydown', onKey)
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || (e.target as HTMLElement).closest('[data-sheet-close]')) close()
  })
  wrap.querySelector<HTMLElement>('.sheet-close')!.focus()

  const closeAndGo = (hash: string) => {
    // Wait for the sheet's own history step to be undone, then navigate.
    window.addEventListener('popstate', () => (location.hash = hash), { once: true })
    close()
  }

  return { body: wrap.querySelector<HTMLElement>('.sheet-body')!, close: () => close(), closeAndGo }
}

function trapFocus(e: KeyboardEvent, container: HTMLElement) {
  const items = [...container.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hasAttribute('disabled'),
  )
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
