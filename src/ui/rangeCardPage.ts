// Range card (#/card/<rifle id>): elevation and wind both sides at the card
// wind speeds, every 25 or 50 yd from 100 yd to the max. Worked out live from
// the current conditions, so it is never out of date. Printable.
import { segmented, setSelected, stepper } from '../design/components.ts'
import type { CardRow } from '../data/match.ts'
import { currentProfile, getData, RANGE_CARD_MAX_YD, RANGE_CARD_MIN_YD, updateData } from '../data/store.ts'
import { computeRangeCard, type RangeCard } from '../match/rangeCard.ts'
import { conditionsSummary, openConditionsSheet } from './conditionsSheet.ts'
import { elevWord, escapeHtml, holdParts } from './format.ts'
import { printArea } from './print.ts'
import { keepScreenAwake } from './wakeLock.ts'

type Unit = 'mil' | 'moa'

function hold(rad: number, unit: Unit, kind: 'elevation' | 'windage', mode: 'dial' | 'hold'): string {
  const p = holdParts(rad, unit, kind)
  const dir = kind === 'elevation' ? elevWord(p.dir, mode) : p.dir
  return dir ? `${dir} ${p.value}` : p.value
}

/** The table, used on screen and (once per unit) in print. */
export function rangeTableHtml(card: RangeCard, unit: Unit, mode: 'dial' | 'hold', windsMph: number[]): string {
  const row = (r: CardRow) => `<tr>
      <th scope="row">${r.rangeYd}</th>
      <td class="tone-elev">${hold(r.elevationRad, unit, 'elevation', mode)}</td>
      ${r.wind.map((w) => `<td class="tone-wind"><span>${hold(w.fromLeftRad, unit, 'windage', mode)}</span><span>${hold(w.fromRightRad, unit, 'windage', mode)}</span></td>`).join('')}
    </tr>`
  const missing = (yd: number) => `<tr><th scope="row">${yd}</th><td>—</td>${windsMph.map(() => '<td>—</td>').join('')}</tr>`
  return `<table class="range-table">
      <thead><tr><th scope="col">Yd</th><th scope="col" class="tone-elev">Elev ${unit === 'mil' ? 'MIL' : 'MOA'}</th>
        ${windsMph.map((m) => `<th scope="col" class="tone-wind">${m} mph<br />L · R</th>`).join('')}</tr></thead>
      <tbody>${card.rows.map(row).join('')}${card.unreachableYd.map(missing).join('')}</tbody>
    </table>`
}

const unreachableNote = (card: RangeCard) =>
  card.unreachableYd.length
    ? `<p class="range-note">— from ${card.unreachableYd[0]} yd: the bullet doesn't get there with these inputs, so no numbers are shown.</p>`
    : ''

export function renderRangeCardPage(root: HTMLElement, param?: string): void {
  const d0 = getData()
  const profile = d0.profiles.find((p) => p.id === param) ?? currentProfile(d0)
  if (!profile) {
    root.innerHTML = `<section class="card"><h2 class="card-title">Range card</h2><p>Add a rifle first.</p>
      <a class="btn btn-primary big-button" href="#/rifles">Add a rifle</a></section>`
    return
  }

  root.innerHTML = `
    <div class="match-head">
      <a class="btn info-btn" href="#/rifles/${profile.id}"><span><strong>${escapeHtml(profile.name)}</strong></span><span aria-hidden="true">▸</span></a>
      <button class="btn info-btn" type="button" data-action="conditions" aria-haspopup="dialog" aria-label="Edit conditions">
        <span data-conditions></span><span aria-hidden="true">▸</span></button>
    </div>
    <div data-table aria-live="polite"><p class="card-working">Working out the card…</p></div>
    <div class="range-controls">
      <section class="control" aria-label="Rows every">
        <h2 class="control-label">Step (yd)</h2>
        ${segmented({ name: 'rcstep', label: 'Rows every', selected: String(d0.settings.rangeCard.stepYd), options: [{ value: '25', label: '25' }, { value: '50', label: '50' }] })}
      </section>
      <section class="control" aria-label="Units">
        <h2 class="control-label">Units</h2>
        ${segmented({ name: 'unit', label: 'Units', selected: d0.settings.angleUnit, options: [{ value: 'mil', label: 'MIL' }, { value: 'moa', label: 'MOA' }] })}
      </section>
    </div>
    <section class="control" aria-label="Max range">
      <h2 class="control-label">Out to</h2>
      ${stepper({ name: 'rcmax', label: 'Max range', value: String(d0.settings.rangeCard.maxYd), unit: 'yd', minusLabel: 'Shorter', plusLabel: 'Farther' })}
    </section>
    <button class="btn big-button" type="button" data-action="print" disabled>Print (MIL and MOA)</button>`

  let latest = 0
  let shown: RangeCard | undefined

  async function show() {
    const run = ++latest
    const d = getData()
    const p = d.profiles.find((x) => x.id === profile!.id)
    if (!p) return
    const { stepYd, maxYd } = d.settings.rangeCard
    root.querySelector('[data-conditions]')!.textContent = conditionsSummary(d.conditions)
    root.querySelector('[data-stepper-value="rcmax"]')!.textContent = String(maxYd)
    setSelected(root, 'data-segment', 'rcstep', String(stepYd))
    setSelected(root, 'data-segment', 'unit', d.settings.angleUnit)
    const box = root.querySelector<HTMLElement>('[data-table]')!
    try {
      const card = await computeRangeCard(p, d.conditions, d.settings.cardWindsMph, stepYd, maxYd)
      if (run !== latest) return
      shown = card
      box.innerHTML = rangeTableHtml(card, d.settings.angleUnit, d.settings.holdMode, d.settings.cardWindsMph) + unreachableNote(card)
      root.querySelector<HTMLButtonElement>('[data-action="print"]')!.disabled = false
    } catch (e) {
      if (run !== latest) return
      console.error(e)
      box.innerHTML = `<p class="field-error">Couldn't work out this card. Check the rifle's numbers.</p>`
    }
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    if (btn.dataset.action === 'conditions') return openConditionsSheet(() => void show())
    if (btn.dataset.action === 'print' && shown) return printRangeCard(profile!.name, shown)
    if (btn.dataset.segment === 'rcstep') {
      updateData((d) => void (d.settings.rangeCard.stepYd = btn.dataset.value === '25' ? 25 : 50))
      return void show()
    }
    const unit = btn.dataset.segment === 'unit' ? btn.dataset.value : undefined
    if (unit === 'mil' || unit === 'moa') {
      updateData((d) => void (d.settings.angleUnit = unit))
      return void show()
    }
    if (btn.dataset.stepper === 'rcmax') {
      const dir = Number(btn.dataset.dir)
      updateData((d) => {
        const next = d.settings.rangeCard.maxYd + dir * 50
        d.settings.rangeCard.maxYd = Math.min(RANGE_CARD_MAX_YD, Math.max(RANGE_CARD_MIN_YD, next))
      })
      return void show()
    }
  })

  const release = keepScreenAwake()
  window.addEventListener('hashchange', release, { once: true })
  void show()
}

function printRangeCard(name: string, card: RangeCard): void {
  const d = getData()
  const head = `<p class="print-head"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(conditionsSummary(d.conditions))} ·
    wind full value, L = from the left, R = from the right · ${new Date().toLocaleDateString()}</p>`
  const table = (unit: Unit) => `<section class="print-range">${head}${rangeTableHtml(card, unit, d.settings.holdMode, d.settings.cardWindsMph)}${unreachableNote(card)}</section>`
  printArea(table('mil') + table('moa'), 'margin: 0.5in;')
}
