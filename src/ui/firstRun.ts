// First run: shown on Shoot when there are no rifles yet. Welcome → your load →
// scope & zero → Shoot. Every step can be skipped (typical values are used), or
// the shooter can try a sample rifle built from the factory ammo library.
import { segmented, setSelected } from '../design/components.ts'
import { combine, DEFAULT_RIFLE, newId, rifleOf, type RifleProfile } from '../data/profiles.ts'
import { getData, updateData } from '../data/store.ts'
import { FACTORY_LOADS } from '../library/ammo.ts'
import { renderFactoryPicker } from './factoryPicker.ts'
import { escapeHtml } from './format.ts'
import { parseFormValues, readFormValues, renderFieldsByKey, showFieldErrors, toFormValues } from './shotForm.ts'

const SAMPLE_LOAD_ID = 'hornady-65cm-140-eldm'

/** A rifle to explore the app with: the maker's published figures, clearly labelled as a sample. */
export function sampleRifle(): RifleProfile {
  const l = FACTORY_LOADS.find((x) => x.id === SAMPLE_LOAD_ID)!
  return {
    id: newId(),
    name: `Sample · ${l.cartridge} ${l.bulletWeightGr} gr`,
    notes: `Sample rifle to try the app: ${l.brand} ${l.product} published figures (${l.testBarrelIn}″ test barrel). Your rifle will differ — add your own and delete this one.`,
    rifle: {
      ...DEFAULT_RIFLE,
      muzzleVelocityFps: l.muzzleVelocityFps,
      bc: l.bc,
      dragModel: l.dragModel,
      bulletWeightGr: l.bulletWeightGr,
      bulletDiameterIn: l.bulletDiameterIn,
      bulletLengthIn: l.bulletLengthIn,
    },
    factory: { loadId: l.id, mvEstimated: true },
    updatedAt: new Date().toISOString(),
  }
}

/** Re-runs the current page (e.g. Shoot) once the setup is done. */
const reopen = () => window.dispatchEvent(new HashChangeEvent('hashchange'))

export function renderFirstRun(root: HTMLElement): void {
  root.innerHTML = `
    <section class="card first-run">
      <h2 class="card-title">Welcome to Spin Drift</h2>
      <p>Let's set up your rifle — about a minute. You can skip any step; typical values are used until you change them in Rifles.</p>
      <button class="btn btn-primary big-button" type="button" data-action="setup">Set up my rifle ▸</button>
      <button class="btn big-button" type="button" data-action="sample">Try a sample rifle</button>
      <p class="hint">The sample is a 6.5 Creedmoor with Hornady's published factory figures, so you can look around first.</p>
    </section>`
  root.querySelector('[data-action="sample"]')!.addEventListener('click', () => {
    const p = sampleRifle()
    updateData((d) => {
      d.profiles.push(p)
      d.shoot.profileId = p.id
    })
    reopen()
  })
  root.querySelector('[data-action="setup"]')!.addEventListener('click', () => {
    // Create the rifle now so the factory ammo picker can fill it.
    const id = newId()
    updateData((d) => {
      d.profiles.push({ id, name: 'My rifle', rifle: { ...DEFAULT_RIFLE }, updatedAt: new Date().toISOString() })
      d.shoot.profileId = id
    })
    loadStep(root, id)
  })
}

/** Saves whatever valid numbers are in the boxes on screen into the rifle. */
function saveBoxes(root: HTMLElement, id: string): boolean {
  const d = getData()
  const p = d.profiles.find((x) => x.id === id)
  if (!p) return false
  const values = { ...toFormValues(combine(p.rifle, d.conditions, d.shoot)), ...readFormValues(root, ['rifle']) }
  const { inputs, fieldErrors } = parseFormValues(values, ['rifle'])
  showFieldErrors(root, fieldErrors)
  const name = root.querySelector<HTMLInputElement>('[name="profileName"]')?.value.trim()
  updateData((data) => {
    const t = data.profiles.find((x) => x.id === id)
    if (!t) return
    if (name !== undefined) t.name = name || 'My rifle'
    if (inputs) {
      if (t.factory?.mvEstimated && inputs.muzzleVelocityFps !== t.rifle.muzzleVelocityFps) t.factory.mvEstimated = false
      t.rifle = rifleOf(inputs)
    }
    t.updatedAt = new Date().toISOString()
  })
  return !!inputs
}

function step(n: number, title: string, body: string): string {
  return `<section class="card first-run">
      <p class="first-run-step">Step ${n} of 2</p>
      <h2 class="card-title">${title}</h2>
      ${body}
    </section>`
}

function loadStep(root: HTMLElement, id: string): void {
  const d = getData()
  const p = d.profiles.find((x) => x.id === id)!
  const values = toFormValues(combine(p.rifle, d.conditions, d.shoot))
  root.innerHTML = step(
    1,
    'Your load',
    `<label class="field"><span>Rifle name</span><input name="profileName" type="text" autocomplete="off" value="${escapeHtml(p.name)}" /></label>
      <button class="btn" type="button" data-action="factory">⇩ Pick factory ammo</button>
      <div data-factory></div>
      <p class="hint">…or type your load:</p>
      ${renderFieldsByKey(['muzzleVelocityFps', 'bc', 'dragModel', 'bulletWeightGr'], values)}
      <button class="btn btn-primary big-button" type="button" data-action="next">Next ▸</button>
      <button class="btn" type="button" data-action="skip">Skip (use typical values)</button>`,
  )
  root.querySelector('[data-action="factory"]')!.addEventListener('click', () =>
    renderFactoryPicker(root.querySelector<HTMLElement>('[data-factory]')!, id, undefined, () => loadStep(root, id)),
  )
  root.querySelector('[data-action="next"]')!.addEventListener('click', () => {
    if (saveBoxes(root, id)) scopeStep(root, id)
  })
  root.querySelector('[data-action="skip"]')!.addEventListener('click', () => scopeStep(root, id))
}

function scopeStep(root: HTMLElement, id: string): void {
  const d = getData()
  const p = d.profiles.find((x) => x.id === id)!
  const values = toFormValues(combine(p.rifle, d.conditions, d.shoot))
  root.innerHTML = step(
    2,
    'Scope & zero',
    `${renderFieldsByKey(['sightHeightIn', 'zeroRangeYd'], values)}
      <div class="setting">
        <h3 class="setting-title">Your turrets</h3>
        ${segmented({ name: 'unit', label: 'Turret units', selected: d.settings.angleUnit, options: [{ value: 'mil', label: 'MIL' }, { value: 'moa', label: 'MOA' }] })}
      </div>
      <button class="btn btn-primary big-button" type="button" data-action="done">Done — go to Shoot ▸</button>
      <button class="btn" type="button" data-action="skip">Skip (use typical values)</button>`,
  )
  root.addEventListener('click', function onClick(e) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    // Ignore the tap that opened this step (it was on step 1's button, now gone).
    if (!btn || !root.contains(btn)) return
    const unit = btn?.dataset.segment === 'unit' ? btn.dataset.value : undefined
    if (unit === 'mil' || unit === 'moa') {
      setSelected(root, 'data-segment', 'unit', unit)
      updateData((data) => void (data.settings.angleUnit = unit))
    }
    if (btn?.dataset.action === 'done' && !saveBoxes(root, id)) return
    if (btn?.dataset.action === 'done' || btn?.dataset.action === 'skip') {
      root.removeEventListener('click', onClick)
      reopen()
    }
  })
}
