// Shoot screen: the one you use on the line. Opens on the last-used rifle,
// shows huge holds, and has glove-sized buttons for range and wind.
import { BallisticsError, getEngine } from '../ballistics/index.ts'
import { combine, type Conditions } from '../data/profiles.ts'
import { RANGE_STEPS_YD, MAX_RANGE_YD, MIN_RANGE_YD, rotateClock, stepRange, stepWindSpeed } from '../data/shootControls.ts'
import { currentProfile, getData, updateData } from '../data/store.ts'
import { toShotInput } from '../shotInputs.ts'
import { yardsToMeters } from '../units/index.ts'
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

    <button class="holds" data-action="unit" aria-label="Tap to switch mil / MOA">
      <span class="hold"><span class="hold-label">ELEV</span><span class="hold-dir" data-elev-dir></span><span class="hold-num" data-elev></span></span>
      <span class="hold"><span class="hold-label">WIND</span><span class="hold-dir" data-wind-dir></span><span class="hold-num" data-wind></span></span>
      <span class="hold-unit" data-unit></span>
    </button>
    <p class="hold-sub" data-sub aria-live="polite"></p>
    ${
      profile.factory?.mvEstimated
        ? '<p class="mv-estimate"><a href="#/log">MV estimated from factory data — log confirmed hits to true it</a></p>'
        : ''
    }
    <a class="button big-button log-button" href="#/log/new">✎ Log this shot</a>

    <section class="control">
      <span class="control-label">Range</span>
      <div class="stepper">
        <button class="step" data-action="range-down" aria-label="Range down">−</button>
        <label class="step-value"><input name="range" type="text" inputmode="numeric" autocomplete="off" aria-label="Range in yards" /><small>yd</small></label>
        <button class="step" data-action="range-up" aria-label="Range up">+</button>
      </div>
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
    const { shoot, conditions, settings } = getData()
    if (document.activeElement !== rangeBox) rangeBox.value = String(shoot.rangeYd)
    $('[data-wind-speed]').textContent = String(shoot.windSpeedMph)
    $('[data-wind-clock]').textContent = String(shoot.windClock)
    $('[data-wind-arrow]').innerHTML = windArrow(shoot.windClock)
    $('[data-unit]').textContent = settings.angleUnit === 'mil' ? 'MIL' : 'MOA'
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
      const [s] = await engine.solve(toShotInput(combine(p.rifle, d.conditions, d.shoot)), [yardsToMeters(d.shoot.rangeYd)])
      if (run !== latest) return
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
    unit: () => change((d) => void (d.settings.angleUnit = d.settings.angleUnit === 'mil' ? 'moa' : 'mil')),
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
  })

  $<HTMLSelectElement>('[name="rifle"]').addEventListener('change', (e) => {
    change((d) => void (d.shoot.profileId = (e.target as HTMLSelectElement).value))
  })

  rangeBox.addEventListener('focus', () => rangeBox.select())
  rangeBox.addEventListener('input', () => {
    const yd = Number(rangeBox.value)
    if (Number.isFinite(yd) && yd >= MIN_RANGE_YD && yd <= MAX_RANGE_YD) change((d) => void (d.shoot.rangeYd = Math.round(yd)))
  })
  rangeBox.addEventListener('blur', show)

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
