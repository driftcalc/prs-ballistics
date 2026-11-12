// Truing in 3 steps (#/log/true): 1 pick your confirmed hits, 2 see how far
// they were from the prediction on a chart, 3 read the plain-English verdict
// and Apply the suggested change (or Undo a change made earlier).
// The analysis itself is the existing truing assistant (src/truing/truing.ts);
// nothing changes on the rifle until Apply is tapped.
import { showUndoToast } from '../design/components.ts'
import type { DopeEntry } from '../data/log.ts'
import type { RifleProfile } from '../data/profiles.ts'
import { getData, updateData } from '../data/store.ts'
import { applySuggestion, revertableChange, revertLastChange, truingValue } from '../truing/apply.ts'
import { analyseTruing, truingPoints, type TruingResult } from '../truing/truing.ts'
import { escapeHtml } from './format.ts'
import { logProfile } from './logPage.ts'
import { fromMil, holdLabel } from './logShotSheet.ts'

type Unit = 'mil' | 'moa'
const fieldName = (f: 'muzzleVelocityFps' | 'bc') => (f === 'muzzleVelocityFps' ? 'muzzle velocity' : 'BC')

/** Confirmed hits with an elevation hold: the only shots truing uses. */
const usable = (log: DopeEntry[], profileId: string) =>
  log.filter((e) => e.profileId === profileId && e.confirmed && e.actualElevationMil !== null).sort((a, b) => a.rangeYd - b.rangeYd)

// The shots unticked in step 1 (kept while you move between steps).
let unticked = new Set<string>()

export function renderTruingFlow(root: HTMLElement): void {
  const profile = logProfile()
  if (!profile) {
    location.hash = '#/log'
    return
  }
  pickStep(root, profile)
}

function frame(n: number, title: string, body: string): string {
  return `<a class="btn back-link" href="#/log">← Logbook</a>
    <section class="card flow">
      <p class="flow-step">Truing · step ${n} of 3</p>
      <h2 class="card-title">${title}</h2>
      ${body}
    </section>`
}

/** Fresh copy of the page root for each step, so click handlers don't pile up. */
function next(root: HTMLElement): HTMLElement {
  const fresh = root.cloneNode(false) as HTMLElement
  root.replaceWith(fresh)
  window.scrollTo(0, 0)
  return fresh
}

// ---------- Step 1: pick shots ----------

function pickStep(root: HTMLElement, profile: RifleProfile): void {
  const d = getData()
  const unit = d.settings.angleUnit
  const shots = usable(d.log, profile.id)
  const hold = (mil: number) => holdLabel(fromMil(mil, unit), unit, 'elev', d.settings.holdMode)
  root.innerHTML = frame(
    1,
    `Pick shots — ${escapeHtml(profile.name)}`,
    shots.length
      ? `<p>Your confirmed hits. Untick any you don't trust (a bad wind call, a flier).</p>
        <ul class="pick-list">${shots
          .map(
            (e) => `<li><label class="check-big"><input type="checkbox" data-shot="${e.id}"${unticked.has(e.id) ? '' : ' checked'} />
              <span><strong>${e.rangeYd} yd</strong> · held ${hold(e.actualElevationMil!)} · predicted ${hold(e.predicted.elevationMil)}<br />
              ${new Date(e.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${e.conditions.temperatureF}°F</span></label></li>`,
          )
          .join('')}</ul>
        <button class="btn btn-primary big-button" type="button" data-action="next">Next: see the chart ▸</button>`
      : `<p>No confirmed hits for this rifle yet. Log shots from the Shoot screen and mark them <strong>Hit</strong>.
          Truing needs at least 3 hits spread over 100 yd or more.</p>
        <a class="btn btn-primary big-button" href="#/shoot">Go to Shoot</a>`,
  )
  root.addEventListener('change', (ev) => {
    const box = ev.target as HTMLInputElement
    if (!box.dataset.shot) return
    if (box.checked) unticked.delete(box.dataset.shot)
    else unticked.add(box.dataset.shot)
  })
  root.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    const chosen = shots.filter((e) => !unticked.has(e.id))
    if (!chosen.length) return
    void reviewStep(next(root), profile.id, chosen)
  })
}

// ---------- Step 2: chart ----------

async function reviewStep(root: HTMLElement, profileId: string, chosen: DopeEntry[]): Promise<void> {
  root.innerHTML = frame(2, 'How close were you?', '<p>Working it out…</p>')
  const d = getData()
  const profile = d.profiles.find((p) => p.id === profileId)!
  let r: TruingResult
  try {
    r = await analyseTruing(profile.rifle, truingPoints(chosen, profileId))
  } catch (e) {
    root.innerHTML = frame(2, 'How close were you?', `<p class="field-error">Couldn't analyse these holds: ${escapeHtml((e as Error).message)}</p>`)
    return
  }
  const unit = d.settings.angleUnit
  const u = unit === 'mil' ? 'mil' : 'MOA'
  const show = (mil: number) => fromMil(mil, unit).toFixed(unit === 'mil' ? 2 : 1)
  const s = r.suggestion
  root.innerHTML = frame(
    2,
    'How close were you?',
    `<p>Each dot is one hit: how far the hold you used was from what the app predicted. On the line = spot on; above = you needed more elevation.</p>
      <div class="truing-chart" data-chart></div>
      <p class="chart-key"><span class="tone-elev">● your holds</span>${s ? ` · <span>○ with the suggested ${fieldName(s.field)}</span>` : ''}</p>
      <table class="compare"><thead><tr><th>Yd</th><th>Held</th><th>Predicted</th>${s ? '<th>With fix</th>' : ''}</tr></thead><tbody>
        ${r.rows
          .map(
            (row) =>
              `<tr><td>${row.rangeYd}</td><td>${show(row.actualMil)}</td><td>${show(row.currentMil)}</td>${s ? `<td>${row.suggestedMil === undefined ? '' : show(row.suggestedMil)}</td>` : ''}</tr>`,
          )
          .join('')}
      </tbody></table>
      <p class="hint">Elevation in ${u}. Windage isn't trued — wind is too uncertain to learn from.</p>
      <button class="btn btn-primary big-button" type="button" data-action="next">Next: the verdict ▸</button>
      <button class="btn" type="button" data-action="back">◀ Back to the shots</button>`,
  )
  const chart = root.querySelector<HTMLElement>('[data-chart]')!
  chart.innerHTML = chartSvg(r, unit, chart.clientWidth || 320)
  root.querySelector('[data-action="next"]')!.addEventListener('click', () => verdictStep(next(root), profileId, r))
  root.querySelector('[data-action="back"]')!.addEventListener('click', () => pickStep(next(root), profile))
}

/** Simple dot chart drawn at the real on-screen width, so text stays full size. */
export function chartSvg(r: TruingResult, unit: Unit, width: number): string {
  const rows = [...r.rows].sort((a, b) => a.rangeYd - b.rangeYd)
  const now = rows.map((row) => ({ x: row.rangeYd, y: fromMil(row.actualMil - row.currentMil, unit) }))
  const fixed = rows.filter((row) => row.suggestedMil !== undefined).map((row) => ({ x: row.rangeYd, y: fromMil(row.actualMil - row.suggestedMil!, unit) }))
  const W = Math.max(280, Math.round(width))
  const H = 240
  const pad = { l: 56, r: 16, t: 16, b: 40 }
  const xs = rows.map((row) => row.rangeYd)
  const x0 = Math.min(...xs) - 50
  const x1 = Math.max(...xs) + 50
  const step = unit === 'mil' ? 0.1 : 0.25
  const lim = Math.max(step * 3, ...[...now, ...fixed].map((p) => Math.abs(p.y))) * 1.15
  const X = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const Y = (y: number) => pad.t + ((lim - y) / (2 * lim)) * (H - pad.t - pad.b)
  const fmt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(unit === 'mil' ? 1 : 2)}`
  const yTicks = [-lim * 0.8, 0, lim * 0.8].map((v) => Number(v.toFixed(2)))
  // Distance labels: skip any that would overlap the one before (the farthest is always kept).
  const gap = 52
  const xLabels: number[] = []
  for (const x of [...new Set(xs)].sort((a, b) => a - b)) {
    while (xLabels.length && X(x) - X(xLabels[xLabels.length - 1]) < gap) xLabels.pop()
    xLabels.push(x)
  }
  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
      aria-label="Your holds compared with the prediction, by distance">
    <line class="chart-axis" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(0)}" y2="${Y(0)}" />
    ${yTicks.map((v) => `<text class="chart-label" x="${pad.l - 6}" y="${Y(v) + 6}" text-anchor="end">${fmt(v)}</text>`).join('')}
    ${xLabels.map((x) => `<text class="chart-label" x="${X(x)}" y="${H - 10}" text-anchor="middle">${x}</text>`).join('')}
    ${fixed.length > 1 ? `<path class="chart-fix" d="${line(fixed)}" />` : ''}
    ${fixed.map((p) => `<circle class="chart-fix-dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="7" />`).join('')}
    ${now.map((p) => `<circle class="chart-dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="8" />`).join('')}
  </svg>`
}

// ---------- Step 3: verdict, Apply, Undo ----------

function verdictStep(root: HTMLElement, profileId: string, r: TruingResult): void {
  const p = getData().profiles.find((x) => x.id === profileId)!
  const s = r.suggestion
  const undo = revertableChange(p)
  root.innerHTML = frame(
    3,
    'The verdict',
    `<p class="truing-headline verdict-${r.verdict}"><strong>${escapeHtml(r.headline)}</strong></p>
      <p>${escapeHtml(r.explanation)}</p>
      ${r.warning ? `<p class="truing-warning">⚠ ${escapeHtml(r.warning)}</p>` : ''}
      ${
        s
          ? `<button class="btn btn-primary big-button" type="button" data-action="apply">Change ${fieldName(s.field)} ${truingValue(s.field, s.current)} → ${truingValue(s.field, s.suggested)}</button>
             <p class="hint">Nothing on “${escapeHtml(p.name)}” changes unless you tap this. The old value is kept so you can undo it.</p>`
          : '<p>Nothing to change on the rifle.</p>'
      }
      ${
        undo
          ? `<button class="btn" type="button" data-action="revert">Undo the last truing change (back to ${truingValue(undo.field, undo.from)})</button>`
          : ''
      }
      <a class="btn" href="#/log">Done</a>`,
  )
  root.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
    if (!s) return
    updateData((data) => {
      const target = data.profiles.find((x) => x.id === profileId)
      if (target) applySuggestion(target, s)
    })
    location.hash = '#/log'
    showUndoToast({
      text: `${fieldName(s.field)[0].toUpperCase()}${fieldName(s.field).slice(1)} is now ${truingValue(s.field, s.suggested)}`,
      onUndo: () => {
        updateData((data) => {
          const target = data.profiles.find((x) => x.id === profileId)
          if (target) revertLastChange(target)
        })
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      },
      ms: 8000,
    })
  })
  root.querySelector('[data-action="revert"]')?.addEventListener('click', () => {
    updateData((data) => {
      const target = data.profiles.find((x) => x.id === profileId)
      if (target) revertLastChange(target)
    })
    location.hash = '#/log'
  })
}

/** Forget which shots were unticked (e.g. when switching rifles). */
export function resetTruingPicks(): void {
  unticked = new Set()
}
