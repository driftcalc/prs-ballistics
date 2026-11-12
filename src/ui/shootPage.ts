// Shoot screen: the one you use on the line. Opens on the last-used rifle,
// shows huge holds at the top and keeps the glove-sized controls lower down,
// where the thumb reaches. Built from the design components.
import { BallisticsError, getEngine } from '../ballistics/index.ts'
import { chipRow, clockDial, openSheet, readout, readoutPair, segmented, setClock, setReadout, setSelected, stepper } from '../design/components.ts'
import { combine, type RifleData } from '../data/profiles.ts'
import { RANGE_STEPS_YD, MAX_RANGE_YD, MIN_RANGE_YD, stepRange, stepWindSpeed } from '../data/shootControls.ts'
import { currentProfile, getData, updateData } from '../data/store.ts'
import { toShotInput } from '../shotInputs.ts'
import { radiansToMil, radiansToMoa, yardsToMeters } from '../units/index.ts'
import { conditionsSummary, openConditionsSheet } from './conditionsSheet.ts'
import { escapeHtml, elevWord, holdParts, timeText, velocityText } from './format.ts'
import { renderFirstRun } from './firstRun.ts'
import { openLogShotSheet } from './logShotSheet.ts'
import { keepScreenAwake } from './wakeLock.ts'

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

  if (!profile) return renderFirstRun(root) // no rifles yet: short setup or a sample rifle

  const unitLabel = d.settings.angleUnit === 'mil' ? 'MIL' : 'MOA'
  root.innerHTML = `
    <!-- Top half: read only -->
    <div class="shoot-info">
      <button class="btn info-btn" type="button" data-action="pick-rifle" aria-haspopup="dialog" aria-label="Change rifle">
        <span data-rifle-name>${escapeHtml(profile.name)}</span><span aria-hidden="true">▾</span></button>
      <button class="btn info-btn" type="button" data-action="conditions" aria-haspopup="dialog" aria-label="Edit conditions">
        <span data-conditions></span><span aria-hidden="true">▸</span></button>
    </div>
    <p class="shoot-range"><span data-range-big>${d.shoot.rangeYd}</span> <span class="shoot-range-unit">yd</span></p>
    ${readoutPair(
      readout({ id: 'elev', label: 'Elev', unit: unitLabel, tone: 'elev' }),
      readout({ id: 'wind', label: 'Wind · hold', unit: unitLabel, tone: 'wind' }),
    )}
    <div class="shot-notes">
      <p data-sub>Loading the ballistics engine…</p>
      <p data-breakdown></p>
      <p data-mv-note hidden><a href="#/log">MV estimated from factory data — log confirmed hits to true it</a></p>
    </div>

    <!-- Bottom half: thumb zone -->
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
      ${clockDial({ label: 'Wind from (tap the hour)', selected: d.shoot.windClock })}
    </section>

    <section class="control toggle-row" aria-label="Display">
      ${segmented({ name: 'mode', label: 'Dial or hold', selected: d.settings.holdMode, options: [{ value: 'dial', label: 'DIAL' }, { value: 'hold', label: 'HOLD' }] })}
      ${segmented({ name: 'unit', label: 'Units', selected: d.settings.angleUnit, options: [{ value: 'mil', label: 'MIL' }, { value: 'moa', label: 'MOA' }] })}
    </section>
    <button class="btn btn-primary log-shot" type="button" data-action="log-shot" aria-haspopup="dialog">✎ Log shot</button>`

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
    $('[data-range-big]').textContent = String(shoot.rangeYd)
    setClock(root, shoot.windClock)
    const unit = settings.angleUnit === 'mil' ? 'MIL' : 'MOA'
    // Dial = turret values, Hold = reticle holds. Same numbers; wind is always a hold.
    setReadout(root, 'elev', { unit, label: settings.holdMode === 'hold' ? 'Elev · hold' : 'Elev · dial' })
    setReadout(root, 'wind', { unit })
    setSelected(root, 'data-segment', 'unit', settings.angleUnit)
    setSelected(root, 'data-segment', 'mode', settings.holdMode)
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
      // In Hold mode elevation reads as a reticle hold: OVER / UNDER instead of UP / DN.
      const elevDir = elevWord(elev.dir, d.settings.holdMode)
      setReadout(root, 'elev', { dir: elevDir, value: elev.value })
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
    }
    if (btn.dataset.clock) return change((d) => void (d.shoot.windClock = Number(btn.dataset.clock)))
    const mode = btn.dataset.segment === 'mode' ? btn.dataset.value : undefined
    if (mode === 'dial' || mode === 'hold') return change((d) => void (d.settings.holdMode = mode))
    if (btn.dataset.chip === 'step') return change((d) => void (d.shoot.rangeStepYd = Number(btn.dataset.value)))
    // Units change only from the explicit MIL / MOA switch, never from tapping the holds.
    const unit = btn.dataset.segment === 'unit' ? btn.dataset.value : undefined
    if (unit === 'mil' || unit === 'moa') return change((d) => void (d.settings.angleUnit = unit))
    if (btn.dataset.action === 'pick-rifle') return pickRifle()
    if (btn.dataset.action === 'conditions') return editConditions()
    if (btn.dataset.action === 'log-shot') return openLogShotSheet()
  })

  function pickRifle() {
    const data = getData()
    const current = currentProfile(data)?.id
    const sheet = openSheet({
      title: 'Rifle',
      field: true,
      content: `<div class="sheet-list">${data.profiles
        .map((p) => `<button class="btn" type="button" data-rifle="${p.id}" aria-pressed="${p.id === current}">${escapeHtml(p.name)}</button>`)
        .join('')}</div>
        <a class="btn" href="#/card/${current ?? ''}" data-go>▦ Range card</a>
        <a class="btn" href="#/rifles" data-go>Manage rifles</a>`,
    })
    sheet.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-rifle]')
      if (!b) return
      change((d) => void (d.shoot.profileId = b.dataset.rifle))
      sheet.close()
    })
    sheet.body.querySelectorAll<HTMLAnchorElement>('a[data-go]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault()
        sheet.closeAndGo(a.getAttribute('href')!)
      }),
    )
  }

  function editConditions() {
    openConditionsSheet(show)
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

  // Keep the screen on while Shoot is open; let it sleep again when you leave.
  const release = keepScreenAwake()
  window.addEventListener('hashchange', release, { once: true })

  show()
}
