// Log tab: the dope logbook.
//   #/log        list for one rifle, grouped by day (with the match of that day)
//   #/log/true   truing in 3 steps (src/ui/truingFlow.ts)
//   #/log/new    old full-page "log a shot" (Shoot now uses a bottom sheet)
//   #/log/<id>   edit an entry
import { parseMil } from '../accuracy/compare.ts'
import { openSheet, segmented, setSelected, showUndoToast } from '../design/components.ts'
import { predict, type DopeEntry, type Prediction } from '../data/log.ts'
import { newId, type Conditions, type RifleData, type WindInputs } from '../data/profiles.ts'
import { currentProfile, getData, updateData, type AppData } from '../data/store.ts'
import { analyseTruing, truingPoints } from '../truing/truing.ts'
import { escapeHtml } from './format.ts'
import { fromMil, holdLabel, toMil } from './logShotSheet.ts'
import { renderTruingFlow, resetTruingPicks } from './truingFlow.ts'

type Unit = 'mil' | 'moa'

// Rifle shown on the Log tab. Starts on the Shoot screen's rifle.
let selectedProfileId: string | undefined

/** The rifle the Log tab (and truing) is showing. */
export function logProfile(d: AppData = getData()) {
  const p = d.profiles.find((x) => x.id === selectedProfileId) ?? currentProfile(d)
  if (p) selectedProfileId = p.id
  return p
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA') // YYYY-MM-DD, local
const dayTitle = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** "+0.2 mil over prediction" / "0.1 MOA under" / "on prediction". */
function diffText(e: DopeEntry, unit: Unit): string {
  if (e.actualElevationMil === null) return ''
  const diff = fromMil(e.actualElevationMil - e.predicted.elevationMil, unit)
  const u = unit === 'mil' ? 'mil' : 'MOA'
  if (Math.abs(diff) < 0.05) return 'on prediction'
  return `${Math.abs(diff).toFixed(unit === 'mil' ? 1 : 2)} ${u} ${diff > 0 ? 'over' : 'under'} prediction`
}

export function renderLogPage(root: HTMLElement, param?: string): void {
  if (param === 'true') return renderTruingFlow(root)
  if (param === 'new') return renderEntryForm(root)
  const entry = getData().log.find((e) => e.id === param)
  if (entry) return renderEntryForm(root, entry)
  renderList(root)
}

function renderList(root: HTMLElement): void {
  const d = getData()
  const unit = d.settings.angleUnit
  const mode = d.settings.holdMode
  const profile = logProfile(d)
  if (!profile) {
    root.innerHTML = `<section class="card"><h2 class="card-title">Logbook</h2><p>Add a rifle first.</p>
      <a class="btn btn-primary big-button" href="#/rifles">Add a rifle</a></section>`
    return
  }
  const entries = d.log.filter((e) => e.profileId === profile.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const days = new Map<string, DopeEntry[]>()
  for (const e of entries) days.set(dayKey(e.createdAt), [...(days.get(dayKey(e.createdAt)) ?? []), e])
  const matchesOn = (key: string) => d.matches.filter((m) => m.date === key).map((m) => m.name)
  const hold = (mil: number | null, kind: 'elev' | 'wind') => (mil === null ? '–' : holdLabel(fromMil(mil, unit), unit, kind, mode))
  const u = unit === 'mil' ? 'MIL' : 'MOA'

  root.innerHTML = `
    <button class="btn info-btn" type="button" data-action="pick-rifle" aria-haspopup="dialog" aria-label="Change rifle">
      <span><strong>${escapeHtml(profile.name)}</strong> · ${entries.length} shot${entries.length === 1 ? '' : 's'}</span><span aria-hidden="true">▾</span></button>
    <section class="card truing-summary" data-truing>
      <h2 class="card-title">Truing</h2>
      <p data-truing-status>Checking your confirmed hits…</p>
      <a class="btn btn-primary big-button" href="#/log/true">True this rifle ▸</a>
    </section>
    ${
      entries.length
        ? [...days.entries()]
            .map(
              ([key, list]) => `<section class="log-day">
          <h2 class="log-day-title">${dayTitle(key)}${matchesOn(key).map((n) => ` · <span class="log-day-match">${escapeHtml(n)}</span>`).join('')}</h2>
          <ul class="log-list">${list
            .map(
              (e) => `<li><a class="btn log-row" href="#/log/${e.id}">
              <span class="log-range">${e.rangeYd}<small> yd</small></span>
              <span class="log-holds">
                <span>Held <strong class="tone-elev">${hold(e.actualElevationMil, 'elev')}</strong> · <strong class="tone-wind">${hold(e.actualWindageMil, 'wind')}</strong> ${u}</span>
                <span>Predicted ${hold(e.predicted.elevationMil, 'elev')} · ${hold(e.predicted.windageMil, 'wind')}</span>
                <span>${diffText(e, unit)}${diffText(e, unit) ? ' · ' : ''}${timeOf(e.createdAt)}</span>
              </span>
              <span class="log-result ${e.confirmed ? 'hit' : 'miss'}">${e.confirmed ? 'HIT' : 'MISS'}</span>
            </a></li>`,
            )
            .join('')}</ul></section>`,
            )
            .join('')
        : `<section class="card"><p>No shots logged for this rifle yet. On the Shoot screen, tap <strong>✎ Log shot</strong> after you fire.</p></section>`
    }`

  root.querySelector('[data-action="pick-rifle"]')!.addEventListener('click', () => {
    const sheet = openSheet({
      title: 'Show the log for',
      field: true,
      content: `<div class="sheet-list">${d.profiles
        .map((p) => `<button class="btn" type="button" data-rifle="${p.id}" aria-pressed="${p.id === profile.id}">${escapeHtml(p.name)}</button>`)
        .join('')}</div>`,
    })
    sheet.body.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-rifle]')
      if (!b) return
      selectedProfileId = b.dataset.rifle
      resetTruingPicks()
      sheet.close()
      renderList(freshRoot(root))
    })
  })

  // One-line truing summary; the full 3-step flow is on #/log/true.
  const points = truingPoints(d.log, profile.id)
  void analyseTruing(profile.rifle, points)
    .then((r) => {
      const box = root.querySelector('[data-truing-status]')
      if (box) box.innerHTML = `<strong class="truing-headline verdict-${r.verdict}">${escapeHtml(r.headline)}</strong>`
    })
    .catch(() => {
      const box = root.querySelector('[data-truing-status]')
      if (box) box.textContent = "Couldn't check these holds yet."
    })
}

/** Swaps in an empty copy of the page root so old click handlers don't pile up. */
function freshRoot(root: HTMLElement): HTMLElement {
  const fresh = root.cloneNode(false) as HTMLElement
  root.replaceWith(fresh)
  return fresh
}

/** New entry (old full-page route) or editing an existing one. */
function renderEntryForm(root: HTMLElement, existing?: DopeEntry): void {
  const d = getData()
  const unit = d.settings.angleUnit
  const profile = existing ? d.profiles.find((p) => p.id === existing.profileId) : currentProfile(d)
  if (!existing && !profile) {
    location.hash = '#/rifles'
    return
  }
  const rifle: RifleData = existing?.rifle ?? profile!.rifle
  const conditions: Conditions = existing?.conditions ?? { ...d.conditions }
  const wind: WindInputs = existing?.wind ?? { windSpeedMph: d.shoot.windSpeedMph, windClock: d.shoot.windClock }
  const name = existing?.profileName ?? profile!.name
  let predicted: Prediction | undefined = existing?.predicted
  let hit = existing?.confirmed ?? false
  const air = conditions.atmosphereMode === 'altitude' ? `${conditions.altitudeFt ?? 0} ft` : `${conditions.stationPressureInHg} inHg`
  const u = unit === 'mil' ? 'mil' : 'MOA'
  const holdText = (mil: number | null, kind: 'elev' | 'wind') => (mil === null ? '' : holdLabel(fromMil(mil, unit), unit, kind))

  root.innerHTML = `
    <a class="btn back-link" href="#/${existing ? 'log' : 'shoot'}">← ${existing ? 'Logbook' : 'Shoot'}</a>
    <section class="card stack">
      <h2 class="card-title">${existing ? 'Logged shot' : 'Log this shot'} — ${escapeHtml(name)}</h2>
      <p>${conditions.temperatureF}°F · ${air} · ${conditions.humidityPct}% RH · wind ${wind.windSpeedMph} mph from ${wind.windClock} o'clock${
        existing ? ` · ${dayTitle(dayKey(existing.createdAt))} ${timeOf(existing.createdAt)}` : ''
      }</p>
      <label class="field"><span>Range (yd)</span>
        <input name="logRange" type="text" inputmode="numeric" value="${existing?.rangeYd ?? d.shoot.rangeYd}" /></label>
      <p class="predicted" data-predicted></p>
      <label class="field"><span>Elevation you used (${u})</span>
        <input name="logElev" type="text" inputmode="text" autocomplete="off" placeholder="e.g. UP 4.2" /></label>
      <label class="field"><span>Windage you used (${u})</span>
        <input name="logWind" type="text" inputmode="text" autocomplete="off" placeholder="e.g. L 0.6" /></label>
      ${segmented({ name: 'result', label: 'Hit or miss', selected: hit ? 'hit' : 'miss', options: [{ value: 'hit', label: 'HIT' }, { value: 'miss', label: 'MISS' }] })}
      <p class="hint">Hit = this hold was confirmed on target. Only hits are used for truing.</p>
      <label class="field"><span>Notes</span><input name="logNotes" type="text" value="${escapeHtml(existing?.notes ?? '')}" placeholder="e.g. 2 of 3 hits, mirage heavy" /></label>
      <ul class="errors" data-errors></ul>
      <button class="btn btn-primary big-button" type="button" data-action="save">${existing ? 'Save changes' : 'Save to logbook'}</button>
      ${existing ? '<button class="btn btn-danger" type="button" data-action="delete">Delete</button>' : ''}
    </section>`

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const rangeBox = $<HTMLInputElement>('[name="logRange"]')
  const elevBox = $<HTMLInputElement>('[name="logElev"]')
  const windBox = $<HTMLInputElement>('[name="logWind"]')

  if (existing) {
    elevBox.value = holdText(existing.actualElevationMil, 'elev')
    windBox.value = holdText(existing.actualWindageMil, 'wind')
  }

  let latest = 0
  async function refreshPrediction(prefill: boolean) {
    const run = ++latest
    const yd = Number(rangeBox.value)
    if (!(yd >= 25 && yd <= 3000)) {
      $('[data-predicted]').textContent = 'Range should be between 25 and 3000 yd.'
      predicted = undefined
      return
    }
    try {
      const p = await predict(rifle, conditions, wind, yd)
      if (run !== latest) return
      predicted = p
      $('[data-predicted]').innerHTML = `App predicts <strong class="tone-elev">${holdText(p.elevationMil, 'elev')}</strong> · <strong class="tone-wind">${holdText(p.windageMil, 'wind')}</strong> ${u}`
      if (prefill) {
        elevBox.value = holdText(p.elevationMil, 'elev')
        windBox.value = holdText(p.windageMil, 'wind')
      }
    } catch (e) {
      if (run !== latest) return
      predicted = undefined
      $('[data-predicted]').textContent = (e as Error).message
    }
  }
  // New shot: start the hold boxes at the prediction so you only change what differed.
  void refreshPrediction(!existing)
  rangeBox.addEventListener('input', () => void refreshPrediction(false))

  root.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (btn?.dataset.segment === 'result') {
      hit = btn.dataset.value === 'hit'
      setSelected(root, 'data-segment', 'result', hit ? 'hit' : 'miss')
    }
    if (btn?.dataset.action === 'save') save()
    if (btn?.dataset.action === 'delete' && existing) {
      const index = getData().log.findIndex((e) => e.id === existing.id)
      updateData((data) => void (data.log = data.log.filter((e) => e.id !== existing.id)))
      location.hash = '#/log'
      showUndoToast({
        text: `Deleted the ${existing.rangeYd} yd entry`,
        onUndo: () => {
          updateData((data) => void data.log.splice(Math.max(0, Math.min(index, data.log.length)), 0, existing))
          window.dispatchEvent(new HashChangeEvent('hashchange'))
        },
      })
    }
  })

  function save() {
    const errors: string[] = []
    const yd = Number(rangeBox.value)
    // Accept UP/DN/OVER/UNDER as well as U/D/L/R.
    const clean = (s: string) => s.replace(/^\s*(UP|OVER)\b/i, 'U').replace(/^\s*(DN|DOWN|UNDER)\b/i, 'D')
    const elev = parseMil(clean(elevBox.value))
    const windage = parseMil(windBox.value)
    if (!(yd >= 25 && yd <= 3000)) errors.push('Range should be between 25 and 3000 yd.')
    if (Number.isNaN(elev)) errors.push('Elevation isn\'t a number (e.g. "UP 4.2" or "4.2").')
    if (Number.isNaN(windage)) errors.push('Windage isn\'t a number (e.g. "L 0.6" or "-0.6").')
    if (!predicted) errors.push('Waiting for the prediction — try again in a moment.')
    $('[data-errors]').innerHTML = errors.map((er) => `<li>${escapeHtml(er)}</li>`).join('')
    if (errors.length || !predicted) return

    const entry: DopeEntry = {
      id: existing?.id ?? newId(),
      profileId: existing?.profileId ?? profile!.id,
      profileName: name,
      rifle,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      rangeYd: Math.round(yd),
      conditions,
      wind,
      actualElevationMil: elev === null ? null : toMil(elev, unit),
      actualWindageMil: windage === null ? null : toMil(windage, unit),
      confirmed: hit,
      notes: $<HTMLInputElement>('[name="logNotes"]').value.trim() || undefined,
      predicted,
    }
    updateData((data) => {
      const i = data.log.findIndex((e) => e.id === entry.id)
      if (i >= 0) data.log[i] = entry
      else data.log.push(entry)
    })
    selectedProfileId = entry.profileId
    location.hash = '#/log'
  }
}
