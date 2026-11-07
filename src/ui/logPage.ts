// Log tab: the dope logbook. #/log = list, #/log/new = log a shot, #/log/<id> = edit.
import { parseMil } from '../accuracy/compare.ts'
import { predict, type DopeEntry, type Prediction } from '../data/log.ts'
import { newId, type Conditions, type RifleData, type WindInputs } from '../data/profiles.ts'
import { currentProfile, getData, updateData } from '../data/store.ts'
import { milToRadians, moaToRadians, radiansToMil, radiansToMoa } from '../units/index.ts'
import { escapeHtml, signed } from './format.ts'
import { renderTruingCard } from './truingCard.ts'

type Unit = 'mil' | 'moa'

/** mil -> number shown in the user's unit */
const fromMil = (mil: number, unit: Unit) => (unit === 'mil' ? mil : radiansToMoa(milToRadians(mil)))
/** typed number in the user's unit -> mil */
const toMil = (v: number, unit: Unit) => (unit === 'mil' ? v : radiansToMil(moaToRadians(v)))

function holdText(mil: number | null, unit: Unit, kind: 'elev' | 'wind'): string {
  if (mil === null) return '–'
  const v = fromMil(mil, unit)
  if (Math.abs(v) < 0.05) return '0.0'
  const dir = kind === 'elev' ? (v > 0 ? 'U' : 'D') : v > 0 ? 'R' : 'L'
  return `${dir} ${Math.abs(v).toFixed(1)}`
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Rifle shown on the Log tab. Starts on the Shoot screen's rifle.
let selectedProfileId: string | undefined

export function renderLogPage(root: HTMLElement, param?: string): void {
  if (param === 'new') return renderEntryForm(root)
  const entry = getData().log.find((e) => e.id === param)
  if (entry) return renderEntryForm(root, entry)
  renderList(root)
}

function renderList(root: HTMLElement): void {
  const d = getData()
  const unit = d.settings.angleUnit
  const profile = d.profiles.find((p) => p.id === selectedProfileId) ?? currentProfile(d)
  if (!profile) {
    root.innerHTML = `<section class="card"><h2>Logbook</h2><p>Add a rifle first.</p>
      <a class="button primary big-button" href="#/rifles">Add a rifle</a></section>`
    return
  }
  selectedProfileId = profile.id
  const entries = d.log.filter((e) => e.profileId === profile.id).reverse()

  root.innerHTML = `
    <select class="rifle-picker" name="logRifle" aria-label="Rifle">
      ${d.profiles.map((p) => `<option value="${p.id}"${p.id === profile.id ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
    </select>
    <div data-truing></div>
    <section class="card">
      <h2>Logged shots <small>(${unit === 'mil' ? 'mil' : 'MOA'})</small></h2>
      <p><small>Log shots from the Shoot screen with <strong>Log this shot</strong>.</small></p>
      <ul class="log-list">
        ${
          entries.length
            ? entries
                .map((e) => {
                  const diff = e.actualElevationMil === null ? null : e.actualElevationMil - e.predicted.elevationMil
                  return `<li><a href="#/log/${e.id}">
                    <span class="log-range">${e.rangeYd} yd</span>
                    <span class="log-holds">held ${holdText(e.actualElevationMil, unit, 'elev')} · ${holdText(e.actualWindageMil, unit, 'wind')}<br />
                      <small>predicted ${holdText(e.predicted.elevationMil, unit, 'elev')} · ${holdText(e.predicted.windageMil, unit, 'wind')}${
                        diff === null ? '' : ` · elev diff ${signed(fromMil(diff, unit))}`
                      }</small></span>
                    <span class="log-meta">${e.confirmed ? '<span class="badge good">confirmed</span>' : '<span class="badge">not confirmed</span>'}<br /><small>${when(e.createdAt)}</small></span>
                  </a></li>`
                })
                .join('')
            : '<li><small>No shots logged for this rifle yet.</small></li>'
        }
      </ul>
    </section>`

  root.querySelector<HTMLSelectElement>('[name="logRifle"]')!.addEventListener('change', (ev) => {
    selectedProfileId = (ev.target as HTMLSelectElement).value
    renderList(root)
  })
  renderTruingCard(root.querySelector<HTMLElement>('[data-truing]')!, profile.id, () => renderList(root))
}

/** New entry (from the Shoot screen's current state) or editing an existing one. */
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
  const air = conditions.atmosphereMode === 'altitude' ? `${conditions.altitudeFt ?? 0} ft` : `${conditions.stationPressureInHg} inHg`
  const u = unit === 'mil' ? 'mil' : 'MOA'

  root.innerHTML = `
    <p><a href="#/${existing ? 'log' : 'shoot'}">&larr; ${existing ? 'Logbook' : 'Shoot'}</a></p>
    <section class="card stack">
      <h2>${existing ? 'Logged shot' : 'Log this shot'} — ${escapeHtml(name)}</h2>
      <small>${conditions.temperatureF}°F · ${air} · ${conditions.humidityPct}% RH · wind ${wind.windSpeedMph} mph from ${wind.windClock} o'clock${
        existing ? ` · ${when(existing.createdAt)}` : ''
      }</small>
      <label class="field big"><span>Range <small>(yd)</small></span>
        <input name="logRange" type="text" inputmode="numeric" value="${existing?.rangeYd ?? d.shoot.rangeYd}" /></label>
      <p class="predicted" data-predicted></p>
      <div class="group" style="border:0;padding:0">
        <label class="field big"><span>Elevation you used <small>(${u})</small></span>
          <input name="logElev" type="text" inputmode="text" autocomplete="off" placeholder="e.g. U 4.2" /></label>
        <label class="field big"><span>Windage you used <small>(${u})</small></span>
          <input name="logWind" type="text" inputmode="text" autocomplete="off" placeholder="e.g. L 0.6" /></label>
      </div>
      <label class="check-big"><input type="checkbox" name="logConfirmed" ${existing?.confirmed ? 'checked' : ''} />
        <span>Confirmed on target<br /><small>Only confirmed holds are used for truing.</small></span></label>
      <label class="field"><span>Notes</span><input name="logNotes" type="text" value="${escapeHtml(existing?.notes ?? '')}" placeholder="e.g. 2 of 3 hits, mirage heavy" /></label>
      <ul class="errors" data-errors></ul>
      <div class="actions">
        <button class="primary big-button" data-action="save">${existing ? 'Save changes' : 'Save to logbook'}</button>
        ${existing ? '<button class="danger big-button" data-action="delete">Delete</button>' : ''}
      </div>
    </section>`

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const rangeBox = $<HTMLInputElement>('[name="logRange"]')
  const elevBox = $<HTMLInputElement>('[name="logElev"]')
  const windBox = $<HTMLInputElement>('[name="logWind"]')
  const showHold = (mil: number | null, kind: 'elev' | 'wind') => (mil === null ? '' : holdText(mil, unit, kind))

  if (existing) {
    elevBox.value = showHold(existing.actualElevationMil, 'elev')
    windBox.value = showHold(existing.actualWindageMil, 'wind')
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
      $('[data-predicted]').innerHTML = `App predicts <strong>${holdText(p.elevationMil, unit, 'elev')}</strong> · <strong>${holdText(p.windageMil, unit, 'wind')}</strong> ${u}`
      if (prefill) {
        elevBox.value = showHold(p.elevationMil, 'elev')
        windBox.value = showHold(p.windageMil, 'wind')
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

  $('[data-action="save"]').addEventListener('click', () => {
    const errors: string[] = []
    const yd = Number(rangeBox.value)
    const elev = parseMil(elevBox.value)
    const windage = parseMil(windBox.value)
    if (!(yd >= 25 && yd <= 3000)) errors.push('Range should be between 25 and 3000 yd.')
    if (Number.isNaN(elev)) errors.push('Elevation isn\'t a number (e.g. "U 4.2" or "4.2").')
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
      confirmed: $<HTMLInputElement>('[name="logConfirmed"]').checked,
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
  })

  root.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (!confirm(`Delete this ${existing!.rangeYd} yd log entry? This can't be undone.`)) return
    updateData((data) => {
      data.log = data.log.filter((e) => e.id !== existing!.id)
    })
    location.hash = '#/log'
  })
}
