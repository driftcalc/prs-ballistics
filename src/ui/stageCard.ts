// The stage card: one stage's holds in the format shooters copy onto a wrist
// coach. Shown three ways: on screen (huge text), printed on a 3x5 index card,
// and as a picture to share or keep on the lock screen.
import type { Stage } from '../data/match.ts'
import { downloadFile } from './download.ts'
import { conditionsSummary } from './conditionsSheet.ts'
import { elevWord, escapeHtml, holdParts } from './format.ts'

/** Everything a card shows, already turned into text. */
export interface CardView {
  stageName: string
  /** 1-based position in the match, and how many stages there are. */
  index: number
  total: number
  rifleName: string
  conditions: string
  unitLabel: 'MIL' | 'MOA'
  modeLabel: 'DIAL' | 'HOLD'
  rows: { name: string; rangeYd: number; elev: string; winds: { mph: number; left: string; right: string }[] }[]
  order: string[]
}

export function cardViewOf(stage: Stage, index: number, total: number, unit: 'mil' | 'moa', mode: 'dial' | 'hold'): CardView | undefined {
  const c = stage.card
  if (!c) return undefined
  const text = (rad: number, kind: 'elevation' | 'windage') => {
    const p = holdParts(rad, unit, kind)
    const dir = kind === 'elevation' ? elevWord(p.dir, mode) : p.dir
    return dir ? `${dir} ${p.value}` : p.value
  }
  return {
    stageName: stage.name,
    index,
    total,
    rifleName: c.profileName,
    conditions: conditionsSummary(c.conditions),
    unitLabel: unit === 'mil' ? 'MIL' : 'MOA',
    modeLabel: mode === 'dial' ? 'DIAL' : 'HOLD',
    rows: c.rows.map((r) => ({
      name: r.name,
      rangeYd: r.rangeYd,
      elev: text(r.elevationRad, 'elevation'),
      winds: r.wind.map((w) => ({ mph: w.mph, left: text(w.fromLeftRad, 'windage'), right: text(w.fromRightRad, 'windage') })),
    })),
    order: stage.order,
  }
}

const orderText = (order: string[]) => (order.length ? `Order: ${order.join(' → ')}` : '')

/** On-screen card (huge text). */
export function stageCardHtml(v: CardView): string {
  return `<article class="stage-card" aria-label="${escapeHtml(v.stageName)} card">
    <header class="stage-card-head">
      <h2 class="stage-card-title">${escapeHtml(v.stageName)}</h2>
      <span class="stage-card-count">${v.index} / ${v.total}</span>
    </header>
    <p class="stage-card-meta">${escapeHtml(v.rifleName)} · ${escapeHtml(v.conditions)}</p>
    <p class="stage-card-key"><span class="tone-elev">ELEV · ${v.modeLabel}</span> · <span class="tone-wind">WIND full value L · R</span> · ${v.unitLabel}</p>
    <ol class="stage-rows">
      ${v.rows
        .map(
          (r) => `<li class="stage-row">
        <span class="stage-row-target"><strong>${escapeHtml(r.name)}</strong> ${r.rangeYd} yd</span>
        <strong class="stage-row-elev tone-elev">${r.elev}</strong>
        ${r.winds.map((w) => `<span class="stage-row-wind tone-wind"><span>${w.mph} mph</span><strong>${w.left} · ${w.right}</strong></span>`).join('')}
      </li>`,
        )
        .join('')}
    </ol>
    ${v.order.length ? `<p class="stage-card-order">${escapeHtml(orderText(v.order))}</p>` : ''}
  </article>`
}

/** Compact version for a 3x5 index card (always black on white). */
function printCardHtml(v: CardView): string {
  const mphs = v.rows[0]?.winds.map((w) => w.mph) ?? []
  return `<section class="print-card">
    <p class="print-head"><strong>${escapeHtml(v.stageName)}</strong> · ${escapeHtml(v.rifleName)} · ${escapeHtml(v.conditions)}</p>
    <table class="print-table">
      <thead><tr><th>Tgt</th><th>Yd</th><th>${v.modeLabel === 'DIAL' ? 'Elev' : 'Hold'} ${v.unitLabel}</th>${mphs.map((m) => `<th>${m} mph L · R</th>`).join('')}</tr></thead>
      <tbody>${v.rows
        .map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${r.rangeYd}</td><td>${r.elev}</td>${r.winds.map((w) => `<td>${w.left} · ${w.right}</td>`).join('')}</tr>`)
        .join('')}</tbody>
    </table>
    ${v.order.length ? `<p class="print-order">${escapeHtml(orderText(v.order))}</p>` : ''}
  </section>`
}

/** Prints the given cards, one per 3x5 index card. */
export function printCards(views: CardView[]): void {
  document.querySelector('.print-area')?.remove()
  const area = document.createElement('div')
  area.className = 'print-area'
  area.dataset.theme = 'sun'
  area.innerHTML = views.map(printCardHtml).join('')
  document.body.append(area)
  document.body.classList.add('printing')
  const done = () => {
    area.remove()
    document.body.classList.remove('printing')
  }
  window.addEventListener('afterprint', done, { once: true })
  window.print()
}

// ---------- Picture ----------

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000'
}

/** Draws the card as a PNG in the current theme's colours (Night stays red on black). */
export async function stageCardImage(v: CardView): Promise<Blob> {
  await document.fonts?.ready
  const font = cssVar('--font')
  const W = 1080
  const pad = 64
  // Sizes chosen so the picture still reads when shown phone-width (about a third of 1080px).
  const windH = 72
  const rowH = 132 + (v.rows[0]?.winds.length ?? 0) * windH + 48
  const H = pad * 2 + 260 + v.rows.length * rowH + (v.order.length ? 96 : 0)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const color = { bg: cssVar('--bg'), text: cssVar('--text'), line: cssVar('--line'), elev: cssVar('--elev'), wind: cssVar('--wind') }
  const text = (s: string, x: number, y: number, size: number, weight: number, fill: string, align: CanvasTextAlign = 'left') => {
    ctx.font = `${weight} ${size}px ${font}`
    ctx.fillStyle = fill
    ctx.textAlign = align
    ctx.fillText(s, x, y)
  }
  ctx.fillStyle = color.bg
  ctx.fillRect(0, 0, W, H)

  let y = pad + 64
  text(v.stageName, pad, y, 72, 900, color.text)
  text(`${v.index} / ${v.total}`, W - pad, y, 56, 800, color.text, 'right')
  y += 76
  text(`${v.rifleName} · ${v.conditions}`, pad, y, 44, 700, color.text)
  y += 64
  text(`ELEV · ${v.modeLabel} · WIND L · R · ${v.unitLabel}`, pad, y, 44, 800, color.text)
  y += 56

  for (const r of v.rows) {
    ctx.fillStyle = color.line
    ctx.fillRect(pad, y, W - pad * 2, 4)
    y += 120
    text(r.name, pad, y, 72, 900, color.text)
    const nameW = ctx.measureText(r.name).width
    text(`${r.rangeYd} yd`, pad + nameW + 24, y, 52, 700, color.text)
    text(r.elev, W - pad, y, 112, 900, color.elev, 'right')
    for (const w of r.winds) {
      y += windH
      text(`${w.mph} mph`, pad, y, 56, 800, color.wind)
      text(`${w.left} · ${w.right}`, W - pad, y, 64, 900, color.wind, 'right')
    }
    y += 60
  }
  if (v.order.length) text(orderText(v.order), pad, y + 48, 48, 800, color.text)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the card.'))), 'image/png'))
}

/** Opens the phone's share sheet with the card picture; saves it where sharing files isn't possible. */
export async function shareCardImage(v: CardView): Promise<'shared' | 'saved' | 'cancelled'> {
  const blob = await stageCardImage(v)
  const name = `${v.stageName.replace(/[^\w-]+/g, '-').toLowerCase() || 'stage'}.png`
  const file = new File([blob], name, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: v.stageName })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  downloadFile(name, blob)
  return 'saved'
}
