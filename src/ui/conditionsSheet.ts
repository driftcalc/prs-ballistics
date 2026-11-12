// Conditions bottom sheet (temperature, pressure or altitude, humidity), shared
// by Shoot and Match. Saves as you type; onChange runs after each valid change.
import { openSheet } from '../design/components.ts'
import { combine, DEFAULT_RIFLE, type Conditions } from '../data/profiles.ts'
import { currentProfile, getData, updateData } from '../data/store.ts'
import { escapeHtml } from './format.ts'
import { parseFormValues, readFormValues, renderShotFields, toFormValues, updateVisibility } from './shotForm.ts'

/** e.g. "59°F · 29.92 inHg · 0% RH" */
export function conditionsSummary(c: Conditions): string {
  const air = c.atmosphereMode === 'altitude' ? `${c.altitudeFt ?? 0} ft` : `${c.stationPressureInHg ?? '?'} inHg`
  return `${c.temperatureF}°F · ${air} · ${c.humidityPct}% RH`
}

export function openConditionsSheet(onChange: () => void): void {
  const data = getData()
  const rifle = currentProfile(data)?.rifle ?? DEFAULT_RIFLE // only the weather fields are shown
  const sheet = openSheet({
    title: 'Conditions',
    field: true,
    content: `<form class="shot-form" novalidate>${renderShotFields(toFormValues(combine(rifle, data.conditions, data.shoot)), false, ['weather'])}</form>
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
    updateData((d) => {
      d.conditions = {
        temperatureF: inputs.temperatureF,
        atmosphereMode: inputs.atmosphereMode,
        stationPressureInHg: inputs.stationPressureInHg,
        altitudeFt: inputs.altitudeFt,
        humidityPct: inputs.humidityPct,
      }
    })
    onChange()
  }
  form.addEventListener('input', save)
  form.addEventListener('change', save)
}
