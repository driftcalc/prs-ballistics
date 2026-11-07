// Shoot screen: the one you use on the line. Opens on the last-used rifle,
// shows huge holds, and has glove-sized buttons for range and wind.
import { BallisticsError, getEngine } from '../ballistics/index.ts'
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
    <circle r="44" fill="none" stroke="currentColor" stroke-width="4" opacity="0.4" />
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
        <h2>Welcome</h2>
        <p>Add your rifle and load first. After that this screen opens straight to it.</p>
        <a class="button primary big-button" href="#/rifles">Add a rifle</a>
      </section>`
    return
  }

  root.innerHTML = `
    <select class="rifle-picker" name="rifle" aria-label="Rifle">
      ${d.profiles.map((p) => `<option value="${p.id}"${p.id === profile.id ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
    </select>

    <div class="holds" aria-live="polite">
      <span class="hold"><span class="hold-label">ELEV</span><span class="hold-dir" data-elev-dir></span><span class="hold-num" data-elev>…</span><span class="hold-u" data-unit></span></span>
      <span class="hold"><span class="hold-label">WIND</span><span class="hold-dir" data-wind-dir></span><span class="hold-num" data-wind>…</span><span class="hold-u" data-unit></span></span>
    </div>
    <div class="unit-switch" role="group" aria-label="Units">
      <button data-unit-set="mil">MIL</button><button data-unit-set="moa">MOA</button>
    </div>
    <p class="hold-sub" data-sub aria-live="polite">Loading the ballistics engine…</p>
    <p class="hold-breakdown" data-breakdown></p>
    <p class="mv-estimate" data-mv-note hidden><a href="#/log">MV estimated from factory data — log confirmed hits to true it</a></p>
    <a class="button big-button log-button" href="#/log/new">✎ Log this shot</a>

    <section class="control">
      <span class="control-label">Range</span>
      <div class="stepper">
        <button class="step" data-action="range-down" aria-label="Range down">−</button>
        <label class="step-value"><input name="range" type="text" inputmode="numeric" autocomplete="off" aria-label="Range in yards" /><small>yd</small></label>
        <button class="step" data-action="range-up" aria-label="Range up">+</button>
      </div>
      <p class="range-error" data-range-error hidden>Range must be ${MIN_RANGE_YD}–${MAX_RANGE_YD} yd — still showing ${'<span data-range-shown></span>'} yd.</p>
      <div class="chips" role="group" aria-label="Range step">
        ${RANGE_STEPS_YD.map((s) => `<button class="chip" data-step="${s}">±${s}</button>`).join('')}
      </div>
    </section>

    <section class="control">
      <span class="control-label">Wind speed</span>
      <div class="stepper">
        <button class="step" data-action="wind-down" aria-label="Wind slower">−</button>
        <div class="step-value"><strong data-wind-speed></strong><small>mph</small></div>
        <button class="step" data-action="wind-up" aria-label="Wind faster">+</button>
      </div>
    </section>

    <section class="control">
      <span class="control-label">Wind from</span>
      <div class="stepper">
        <button class="step" data-action="clock-back" aria-label="Turn wind counter-clockwise">⟲</button>
        <div class="step-value wind-dir"><span data-wind-arrow></span><strong data-wind-clock></strong><small>o'clock</small></div>
        <button class="step" data-action="clock-fwd" aria-label="Turn wind clockwise">⟳</button>
      </div>
    </section>

    <details class="card conditions">
      <summary><strong>Conditions:</strong> <span data-conditions></span></summary>
      <form class="shot-form" novalidate>${renderShotFields(toFormValues(combine(profile.rifle, d.conditions, d.shoot)), false, ['weather'])}</form>
      <ul class="errors" data-errors></ul>
    </details>`

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const rangeBox = $<HTMLInputElement>('[name="range"]')
  const weatherForm = $<HTMLFormElement>('form')
  let latest = 0

  function show() {
    const data = getData()
    const { shoot, conditions, settings } = data
    if (document.activeElement !== rangeBox) rangeBox.value = String(shoot.rangeYd)
    // The note belongs to whichever rifle is picked now, not the one the screen opened on.
    $('[data-mv-note]').hidden = !currentProfile(data)?.factory?.mvEstimated
    $('[data-wind-speed]').textContent = String(shoot.windSpeedMph)
    $('[data-wind-clock]').textContent = String(shoot.windClock)
    $('[data-wind-arrow]').innerHTML = windArrow(shoot.windClock)
    root.querySelectorAll('[data-unit]').forEach((el) => (el.textContent = settings.angleUnit === 'mil' ? 'MIL' : 'MOA'))
    root.querySelectorAll<HTMLButtonElement>('[data-unit-set]').forEach((b) => {
      b.toggleAttribute('aria-pressed', b.dataset.unitSet === settings.angleUnit)
    })
    $('[data-conditions]').textContent = conditionsSummary(conditions)
    root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => {
      b.toggleAttribute('aria-pressed', Number(b.dataset.step) === shoot.rangeStepYd)
    })
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
      $('[data-elev-dir]').textContent = elev.dir
      $('[data-elev]').textContent = elev.value
      $('[data-wind-dir]').textContent = wind.dir
      $('[data-wind]').textContent = wind.value
      // Shrink both numbers together when either has 3+ digits before the point (e.g. 143.1 MOA).
      const long = Math.max(elev.value.length, wind.value.length) > 4
      root.querySelectorAll('.hold-num').forEach((el) => el.toggleAttribute('data-long', long))
      $('[data-sub]').textContent = `${velocityText(s.velocity)} · ${timeText(s.timeOfFlight)} · ${d.shoot.rangeYd} yd`
    } catch (e) {
      if (run !== latest) return
      for (const sel of ['[data-elev-dir]', '[data-elev]', '[data-wind-dir]', '[data-wind]']) $(sel).textContent = '–'
      $('[data-sub]').textContent = e instanceof BallisticsError ? e.message : 'Could not calculate this shot.'
      if (!(e instanceof BallisticsError)) console.error(e)
    }
  }

  const change = (fn: Parameters<typeof updateData>[0]) => {
    updateData(fn)
    show()
  }

  const actions: Record<string, () => void> = {
    'range-down': () => change((d) => void (d.shoot.rangeYd = stepRange(d.shoot.rangeYd, d.shoot.rangeStepYd, -1))),
    'range-up': () => change((d) => void (d.shoot.rangeYd = stepRange(d.shoot.rangeYd, d.shoot.rangeStepYd, 1))),
    'wind-down': () => change((d) => void (d.shoot.windSpeedMph = stepWindSpeed(d.shoot.windSpeedMph, -1))),
    'wind-up': () => change((d) => void (d.shoot.windSpeedMph = stepWindSpeed(d.shoot.windSpeedMph, 1))),
    'clock-back': () => change((d) => void (d.shoot.windClock = rotateClock(d.shoot.windClock, -1))),
    'clock-fwd': () => change((d) => void (d.shoot.windClock = rotateClock(d.shoot.windClock, 1))),
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    if (btn.dataset.action) actions[btn.dataset.action]?.()
    if (btn.dataset.step) change((d) => void (d.shoot.rangeStepYd = Number(btn.dataset.step)))
    // Units change only from the explicit MIL / MOA switch, never from tapping the holds.
    const unit = btn.dataset.unitSet
    if (unit === 'mil' || unit === 'moa') change((d) => void (d.settings.angleUnit = unit))
  })

  $<HTMLSelectElement>('[name="rifle"]').addEventListener('change', (e) => {
    change((d) => void (d.shoot.profileId = (e.target as HTMLSelectElement).value))
  })

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

  weatherForm.addEventListener('input', saveWeather)
  weatherForm.addEventListener('change', saveWeather)
  function saveWeather() {
    const values = readFormValues(weatherForm, ['weather'])
    updateVisibility(weatherForm, values, ['weather'])
    const { inputs, errors } = parseFormValues(values, ['weather'])
    $('[data-errors]').innerHTML = errors.map((er) => `<li>${escapeHtml(er)}</li>`).join('')
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

  show()
}
