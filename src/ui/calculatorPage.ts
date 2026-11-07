// Calculator page: one target distance in, dial-up and wind correction out.
import { BallisticsError, getEngine } from '../ballistics/index.ts'
import { DEFAULT_INPUTS, toShotInput } from '../shotInputs.ts'
import { yardsToMeters } from '../units/index.ts'
import { elevationText, escapeHtml, timeText, velocityText, windageText } from './format.ts'
import { parseFormValues, readFormValues, renderShotFields, toFormValues, updateVisibility, type FormValues } from './shotForm.ts'
import { load, save } from './storage.ts'

const STORE_INPUTS = 'calc.inputs'
const STORE_TARGET = 'calc.targetYd'

export function renderCalculatorPage(root: HTMLElement): void {
  const values = load<FormValues>(STORE_INPUTS, toFormValues(DEFAULT_INPUTS))
  const target = load<string>(STORE_TARGET, '600')

  root.innerHTML = `
    <section class="card target">
      <label class="field big"><span>Target range <small>(yd)</small></span>
        <input name="targetYd" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(target)}" />
      </label>
      <div class="result" aria-live="polite"></div>
    </section>
    <form class="shot-form" novalidate>${renderShotFields(values)}</form>
  `

  const form = root.querySelector<HTMLFormElement>('form')!
  const targetBox = root.querySelector<HTMLInputElement>('[name="targetYd"]')!
  const resultBox = root.querySelector<HTMLDivElement>('.result')!
  let latest = 0

  async function recalc() {
    const run = ++latest
    const v = readFormValues(form)
    updateVisibility(form, v)
    save(STORE_INPUTS, v)
    save(STORE_TARGET, targetBox.value.trim())

    const { inputs, errors } = parseFormValues(v)
    const targetYd = Number(targetBox.value.trim().replace(',', '.'))
    if (!(targetYd >= 10 && targetYd <= 3000)) errors.push('Target range should be between 10 and 3000 yd.')
    if (!inputs || errors.length) {
      resultBox.innerHTML = `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
      return
    }

    try {
      if (!resultBox.innerHTML) resultBox.textContent = 'Calculating…'
      const engine = await getEngine()
      const [s] = await engine.solve(toShotInput(inputs), [yardsToMeters(targetYd)])
      if (run !== latest) return // a newer calculation has started
      resultBox.innerHTML = `
        <div class="row"><span class="label">Elevation</span>
          <span class="value">${elevationText(s.elevation, 'mil')} <small>mil</small></span>
          <span class="alt">${elevationText(s.elevation, 'moa')} MOA</span></div>
        <div class="row"><span class="label">Windage</span>
          <span class="value">${windageText(s.windage, 'mil')} <small>mil</small></span>
          <span class="alt">${windageText(s.windage, 'moa')} MOA</span></div>
        <div class="row small"><span class="label">Velocity</span><span>${velocityText(s.velocity)}</span>
          <span class="label">Time of flight</span><span>${timeText(s.timeOfFlight)}</span></div>`
    } catch (e) {
      if (run !== latest) return
      const msg = e instanceof BallisticsError ? e.message : 'Something went wrong calculating this shot.'
      resultBox.innerHTML = `<ul class="errors"><li>${escapeHtml(msg)}</li></ul>`
      if (!(e instanceof BallisticsError)) console.error(e)
    }
  }

  root.addEventListener('input', recalc)
  root.addEventListener('change', recalc)
  void recalc()
}
