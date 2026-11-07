// Shoot screen: the one you use on the line. Opens on the last-used rifle,
// shows huge holds at the top and keeps the glove-sized controls lower down,
// where the thumb reaches. Built from the design components.
import { BallisticsError, getEngine } from '../ballistics/index.ts'
import { chipRow, openSheet, readout, segmented, setReadout, setSelected, stepper } from '../design/components.ts'
import { combine, type Conditions, type RifleData } from '../data/profiles.ts'
import { RANGE_STEPS_YD, MAX_RANGE_YD, MIN_RANGE_YD, rotateClock, stepRange, stepWindSpeed } from '../data/shootControls.ts'
import { currentProfile, getData, updateData } from '../data/store.ts'
import { toShotInput } from '../shotInputs.ts'
import { radiansToMil, radiansToMoa, yardsToMeters } from '../units/index.ts'
import { escapeHtml, holdParts, timeText, velocityText } from './format.ts'
import { parseFormValues, readFormValues, renderShotFields, toFormValues, updateVisibility } from './shotForm.ts'

function conditionsSummary(c: Conditions): string {
  const air = c.atmosphereMode === 'altitude' ? `${c.altitudeFt ?? 0} ft` : `${c.stationPressureInHg ?? '?'} inHg`
  return `${c.temperatureF}°F · ${air} · ${c.humidityPct}% RH`
}

/** Arrow showing where the wind blows TO, on a small clock face. */
function windArrow(clock: number): string {
  const angle = clock * 30 + 180 // wind from 3 o'clock travels toward 9 o'clock
  return `<svg class="wind-arrow" viewBox="-50 -50 100 100" aria-hidden="true">
    <circle r="44" fill="none" stroke="currentColor" stroke-width="3" />
    <g transform="rotate(${angle})">
      <line x1="0" y1="34" x2="0" y2="-24" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
      <path d="M -16 -16 L 0 -38 L 16 -16 Z" fill="currentColor" />
    </g></svg>`
}

/**
 * Splits the WIND hold into its parts, e.g. "Hold = wind R 1.0 + spin drift L 0.1"
 * (both are holds: a right-twist barrel drifts right, so its part is held LEFT),
 * so windage at 0 mph (spin drift) doesn't look like a mistake.
 */
function breakdownText(totalRad: number, spinRad: number, rifle: RifleData, unit: 'mil' | 'moa'): string {
  const hasTwist = rifle.twistIn !== undefined
  const spinOn = hasTwist && rifle.bulletLengthIn !== undefined && rifle.bulletDiameterIn !== undefined
  if (!spinOn) return hasTwist ? 'Spin drift off — add bullet diameter and length on the rifle to include it.' : ''
  // Round the total and the spin part the same way the big number is rounded,
  // then take the wind part as the difference, so the parts always add up to
  // exactly what WIND shows.
  const toUnit = (rad: number) => (unit === 'mil' ? radiansToMil(rad) : radiansToMoa(rad))
  const r1 = (n: number) => Math.round(n * 10) / 10
  const total = r1(toUnit(totalRad))
  const spin = r1(toUnit(spinRad))
  const part = (n: number) => (Math.abs(n) < 0.05 ? '0.0' : `${n > 0 ? 'R' : 'L'} ${Math.abs(n).toFixed(1)}`)
  return `Hold = wind ${part(total - spin)} + spin drift ${part(spin)}`
}

export function renderShootPage(root: HTMLElement): void {
  const d = getData()
  const profile = currentProfile(d)

  if (!profile) {
    root.innerHTML = `
      <section class="card">
        <h2 class="card-title">Welcome</h2>
        <p>Add your rifle and load first. After that this screen opens straight to it.</p>
        <a class="btn btn-primary" href="#/rifles">Add a rifle</a>
      </section>`
    return
  }

  const unitLabel = d.settings.angleUnit === 'mil' ? 'MIL' : 'MOA'
  root.innerHTML = `
    <button class="btn picker" type="button" data-action="pick-rifle" aria-haspopup="dialog">
      <span data-rifle-name>${escapeHtml(profile.name)}</span><span aria-hidden="true">▾</span>
    </button>

    <div class="readout-pair" aria-live="polite">
      ${readout({ id: 'elev', label: 'Elevation', unit: unitLabel })}
      ${readout({ id: 'wind', label: 'Wind', unit: unitLabel })}
    </div>
    <div class="shot-notes">
      <p data-sub>Loading the ballistics engine…</p>
      <p data-breakdown></p>
      <p data-mv-note hidden><a href="#/log">MV estimated from factory data — log confirmed hits to true it</a></p>
    </div>

    <section class="control" aria-label="Range">
      <h2 class="control-label">Range</h2>
      ${stepper({ name: 'range', label: 'Range', value: String(d.shoot.rangeYd), unit: 'yd', input: true })}
      <p class="field-error" data-range-error hidden role="alert">Range must be ${MIN_RANGE_YD}–${MAX_RANGE_YD} yd — still showing <span data-range-shown></span> yd.</p>
      ${chipRow({ name: 'step', label: 'Range step', selected: String(d.shoot.rangeStepYd), options: RANGE_STEPS_YD.map((s) => ({ value: String(s), label: `±${s}` })) })}
    </section>

    <section class="control" aria-label="Wind">
      <h2 class="control-label">Wind speed</h2>
      ${stepper({ name: 'wind', label: 'Wind speed', value: String(d.shoot.windSpeedMph), unit: 'mph', minusLabel: 'Wind slower', plusLabel: 'Wind faster' })}
      <h2 class="control-label">Wind from</h2>
      ${stepper({
        name: 'clock',
        label: 'Wind direction',
        value: String(d.shoot.windClock),
        unit: "o'clock",
        prefixHtml: '<span class="wind-arrow-box" data-wind-arrow></span>',
        minus: '⟲',
        plus: '⟳',
        minusLabel: 'Turn wind counter-clockwise',
        plusLabel: 'Turn wind clockwise',
      })}
    </section>

    <section class="control" aria-label="Units">
      <h2 class="control-label">Units</h2>
      ${segmented({ name: 'unit', label: 'Units', selected: d.settings.angleUnit, options: [{ value: 'mil', label: 'MIL' }, { value: 'moa', label: 'MOA' }] })}
    </section>
    <a class="btn" href="#/log/new">✎ Log this shot</a>

    <button class="btn picker" type="button" data-action="conditions" aria-haspopup="dialog">
      <span><strong>Conditions</strong> <span data-conditions></span></span><span aria-hidden="true">▸</span>
    </button>`

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const rangeBox = $<HTMLInputElement>('[name="range"]')
  let latest = 0

  function show() {
    const data = getData()
    const { shoot, conditions, settings } = data
    const p = currentProfile(data)
    if (document.activeElement !== rangeBox) rangeBox.value = String(shoot.rangeYd)
    $('[data-rifle-name]').textContent = p?.name ?? ''
    // The note belongs to whichever rifle is picked now, not the one the screen opened on.
    $('[data-mv-note]').hidden = !p?.factory?.mvEstimated
    $('[data-stepper-value="wind"]').textContent = String(shoot.windSpeedMph)
    $('[data-stepper-value="clock"]').textContent = String(shoot.windClock)
    $('[data-wind-arrow]').innerHTML = windArrow(shoot.windClock)
    const unit = settings.angleUnit === 'mil' ? 'MIL' : 'MOA'
    setReadout(root, 'elev', { unit })
    setReadout(root, 'wind', { unit })
    setSelected(root, 'data-segment', 'unit', settings.angleUnit)
    setSelected(root, 'data-chip', 'step', String(shoot.rangeStepYd))
    $('[data-conditions]').textContent = conditionsSummary(conditions)
    void recalc()
  }

  async function recalc() {
    const run = ++latest
    const d = getData()
    const p = currentProfile(d)
    if (!p) return
    try {
      const engine = await getEngine()
      const range = [yardsToMeters(d.shoot.rangeYd)]
      const [s] = await engine.solve(toShotInput(combine(p.rifle, d.conditions, d.shoot)), range)
      // Same shot with no wind: whatever windage is left is spin drift.
      const [calm] = await engine.solve(toShotInput(combine(p.rifle, d.conditions, { ...d.shoot, windSpeedMph: 0 })), range)
      if (run !== latest) return
      $('[data-breakdown]').textContent = breakdownText(s.windage, calm.windage, p.rifle, d.settings.angleUnit)
      const unit = d.settings.angleUnit
      const elev = holdParts(s.elevation, unit, 'elevation')
      const wind = holdParts(s.windage, unit, 'windage')
      setReadout(root, 'elev', { dir: elev.dir, value: elev.value })
      setReadout(root, 'wind', { dir: wind.dir, value: wind.value })
      $('[data-sub]').textContent = `${velocityText(s.velocity)} · ${timeText(s.timeOfFlight)} · ${d.shoot.rangeYd} yd`
    } catch (e) {
      if (run !== latest) return
      setReadout(root, 'elev', { dir: '', value: '–' })
      setReadout(root, 'wind', { dir: '', value: '–' })
      $('[data-sub]').textContent = e instanceof BallisticsError ? e.message : 'Could not calculate this shot.'
      if (!(e instanceof BallisticsError)) console.error(e)
    }
  }

  const change = (fn: Parameters<typeof updateData>[0]) => {
    updateData(fn)
    show()
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    const dir = Number(btn.dataset.dir) as 1 | -1
    switch (btn.dataset.stepper) {
      case 'range':
        return change((d) => void (d.shoot.rangeYd = stepRange(d.shoot.rangeYd, d.shoot.rangeStepYd, dir)))
      case 'wind':
        return change((d) => void (d.shoot.windSpeedMph = stepWindSpeed(d.shoot.windSpeedMph, dir)))
      case 'clock':
        return change((d) => void (d.shoot.windClock = rotateClock(d.shoot.windClock, dir)))
    }
    if (btn.dataset.chip === 'step') return change((d) => void (d.shoot.rangeStepYd = Number(btn.dataset.value)))
    // Units change only from the explicit MIL / MOA switch, never from tapping the holds.
    const unit = btn.dataset.segment === 'unit' ? btn.dataset.value : undefined
    if (unit === 'mil' || unit === 'moa') return change((d) => void (d.settings.angleUnit = unit))
    if (btn.dataset.action === 'pick-rifle') return pickRifle()
    if (btn.dataset.action === 'conditions') return editConditions()
  })

  function pickRifle() {
    const data = getData()
    const current = currentProfile(data)?.id
    const sheet = openSheet({
      title: 'Rifle',
      content: `<div class="sheet-list">${data.profiles
        .map((p) => `<button class="btn" type="button" data-rifle="${p.id}" aria-pressed="${p.id === current}">${escapeHtml(p.name)}</button>`)
        .join('')}</div>
        <a class="btn" href="#/rifles" data-sheet-close>Manage rifles</a>`,
    })
    sheet.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-rifle]')
      if (!b) return
      change((d) => void (d.shoot.profileId = b.dataset.rifle))
      sheet.close()
    })
    sheet.body.querySelector('a[href="#/rifles"]')!.addEventListener('click', (e) => {
      e.preventDefault()
      sheet.closeAndGo('#/rifles')
    })
  }

  function editConditions() {
    const data = getData()
    const p = currentProfile(data)!
    const sheet = openSheet({
      title: 'Conditions',
      content: `<form class="shot-form" novalidate>${renderShotFields(toFormValues(combine(p.rifle, data.conditions, data.shoot)), false, ['weather'])}</form>
        <ul class="errors" data-errors></ul>
        <button class="btn btn-primary" type="button" data-sheet-close>Done</button>`,
    })
    const form = sheet.body.querySelector<HTMLFormElement>('form')!
    const save = () => {
      const values = readFormValues(form, ['weather'])
      updateVisibility(form, values, ['weather'])
      const { inputs, errors } = parseFormValues(values, ['weather'])
      sheet.body.querySelector('[data-errors]')!.innerHTML = errors.map((er) => `<li>${escapeHtml(er)}</li>`).join('')
      if (!inputs) return
      change((d) => {
        d.conditions = {
          temperatureF: inputs.temperatureF,
          atmosphereMode: inputs.atmosphereMode,
          stationPressureInHg: inputs.stationPressureInHg,
          altitudeFt: inputs.altitudeFt,
          humidityPct: inputs.humidityPct,
        }
      })
    }
    form.addEventListener('input', save)
    form.addEventListener('change', save)
  }

  rangeBox.addEventListener('focus', () => rangeBox.select())
  const rangeError = $('[data-range-error]')
  rangeBox.addEventListener('input', () => {
    const text = rangeBox.value.trim()
    const yd = Number(text)
    const ok = text !== '' && Number.isFinite(yd) && yd >= MIN_RANGE_YD && yd <= MAX_RANGE_YD
    // Say why the holds didn't change, instead of silently ignoring the number.
    rangeError.hidden = ok || text === ''
    rangeBox.toggleAttribute('aria-invalid', !rangeError.hidden)
    $('[data-range-shown]').textContent = String(getData().shoot.rangeYd)
    if (ok) change((d) => void (d.shoot.rangeYd = Math.round(yd)))
  })
  rangeBox.addEventListener('blur', () => {
    rangeError.hidden = true
    rangeBox.removeAttribute('aria-invalid')
    show()
  })

  show()
}
