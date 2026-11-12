// "Log shot" from Shoot: a bottom sheet pre-filled with the range, conditions,
// wind and the predicted hold. Adjust the hold you actually used with the
// steppers (one click at a time), tap Hit or Miss, then Save. Undo for 5 s.
import { openSheet, segmented, setSelected, showUndoToast, stepper } from '../design/components.ts'
import { predict, type DopeEntry, type Prediction } from '../data/log.ts'
import { newId } from '../data/profiles.ts'
import { currentProfile, getData, updateData } from '../data/store.ts'
import { milToRadians, moaToRadians, radiansToMil, radiansToMoa } from '../units/index.ts'
import { conditionsSummary } from './conditionsSheet.ts'
import { elevWord, escapeHtml } from './format.ts'

type Unit = 'mil' | 'moa'
/** One scope click: 0.1 mil or 1/4 MOA. */
export const CLICK = { mil: 0.1, moa: 0.25 } as const

export const fromMil = (mil: number, unit: Unit) => (unit === 'mil' ? mil : radiansToMoa(milToRadians(mil)))
export const toMil = (v: number, unit: Unit) => (unit === 'mil' ? v : radiansToMil(moaToRadians(v)))
/** Rounds to the nearest whole click (and tidies floating-point noise). */
export const toClick = (v: number, unit: Unit) => Number((Math.round(v / CLICK[unit]) * CLICK[unit]).toFixed(2))

/** "UP 4.0" / "DN 0.3" / "L 0.7" / "0.0" in the shooter's unit. */
export function holdLabel(v: number, unit: Unit, kind: 'elev' | 'wind', mode: 'dial' | 'hold' = 'dial'): string {
  const digits = unit === 'mil' ? 1 : 2
  if (Math.abs(v) < CLICK[unit] / 2) return (0).toFixed(digits)
  const dir = kind === 'elev' ? elevWord(v > 0 ? 'UP' : 'DN', mode) : v > 0 ? 'R' : 'L'
  return `${dir} ${Math.abs(v).toFixed(digits)}`
}

export function openLogShotSheet(): void {
  const d = getData()
  const profile = currentProfile(d)
  if (!profile) return
  const unit = d.settings.angleUnit
  const mode = d.settings.holdMode
  const u = unit === 'mil' ? 'MIL' : 'MOA'
  const rangeYd = d.shoot.rangeYd
  const conditions = { ...d.conditions }
  const wind = { windSpeedMph: d.shoot.windSpeedMph, windClock: d.shoot.windClock }

  let predicted: Prediction | undefined
  let elev = 0 // in the shooter's unit, up = +
  let windage = 0 // right = +
  let result: 'hit' | 'miss' | undefined

  const sheet = openSheet({
    title: `Log shot · ${rangeYd} yd`,
    field: true,
    content: `
      <p class="log-sheet-meta">${escapeHtml(profile.name)} · ${escapeHtml(conditionsSummary(conditions))} · wind ${wind.windSpeedMph} mph from ${wind.windClock} o'clock</p>
      <p class="log-sheet-predicted" data-predicted>Working out the prediction…</p>
      <section class="control" aria-label="Elevation used">
        <h3 class="control-label tone-elev">Elevation used (${u})</h3>
        ${stepper({ name: 'logElev', label: 'Elevation used', value: '…', minus: '−', plus: '+', minusLabel: 'One click down', plusLabel: 'One click up' })}
      </section>
      <section class="control" aria-label="Windage used">
        <h3 class="control-label tone-wind">Windage used (${u})</h3>
        ${stepper({ name: 'logWind', label: 'Windage used', value: '…', minus: 'L', plus: 'R', minusLabel: 'One click left', plusLabel: 'One click right' })}
      </section>
      ${segmented({ name: 'result', label: 'Hit or miss', selected: '', options: [{ value: 'hit', label: 'HIT' }, { value: 'miss', label: 'MISS' }] })}
      <p class="hint">Hit = this hold was confirmed on target (used for truing).</p>
      <div class="sheet-footer"><button class="btn btn-primary big-button" type="button" data-action="save" disabled>Save</button></div>`,
  })
  const body = sheet.body
  const save = body.querySelector<HTMLButtonElement>('[data-action="save"]')!

  const show = () => {
    body.querySelector('[data-stepper-value="logElev"]')!.textContent = predicted ? holdLabel(elev, unit, 'elev', mode) : '…'
    body.querySelector('[data-stepper-value="logWind"]')!.textContent = predicted ? holdLabel(windage, unit, 'wind') : '…'
    save.disabled = !predicted || !result
    save.textContent = !predicted ? 'Save' : result ? `Save — ${result === 'hit' ? 'Hit' : 'Miss'}` : 'Tap Hit or Miss first'
  }
  show()

  void predict(profile.rifle, conditions, wind, rangeYd)
    .then((p) => {
      predicted = p
      elev = toClick(fromMil(p.elevationMil, unit), unit)
      windage = toClick(fromMil(p.windageMil, unit), unit)
      body.querySelector('[data-predicted]')!.innerHTML = `Predicted <strong class="tone-elev">${holdLabel(
        fromMil(p.elevationMil, unit),
        unit,
        'elev',
        mode,
      )}</strong> · <strong class="tone-wind">${holdLabel(fromMil(p.windageMil, unit), unit, 'wind')}</strong> ${u}`
      show()
    })
    .catch((e: Error) => {
      body.querySelector('[data-predicted]')!.textContent = `Can't log this shot: ${e.message}`
    })

  body.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn || !predicted) return
    const step = CLICK[unit] * Number(btn.dataset.dir)
    if (btn.dataset.stepper === 'logElev') elev = toClick(elev + step, unit)
    if (btn.dataset.stepper === 'logWind') windage = toClick(windage + step, unit)
    if (btn.dataset.segment === 'result') {
      result = btn.dataset.value === 'hit' ? 'hit' : 'miss'
      setSelected(body, 'data-segment', 'result', result)
    }
    if (btn.dataset.action === 'save' && result) {
      const entry: DopeEntry = {
        id: newId(),
        profileId: profile.id,
        profileName: profile.name,
        rifle: { ...profile.rifle },
        createdAt: new Date().toISOString(),
        rangeYd,
        conditions,
        wind,
        actualElevationMil: toMil(elev, unit),
        actualWindageMil: toMil(windage, unit),
        confirmed: result === 'hit',
        predicted,
      }
      updateData((data) => void data.log.push(entry))
      sheet.close()
      showUndoToast({
        text: `Logged ${rangeYd} yd · ${result === 'hit' ? 'Hit' : 'Miss'}`,
        onUndo: () => updateData((data) => void (data.log = data.log.filter((x) => x.id !== entry.id))),
      })
      return
    }
    show()
  })
}
