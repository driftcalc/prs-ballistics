// Rifles page: saved rifle/load profiles. Edits save as you type.
import { combine, DEFAULT_RIFLE, newId, rifleOf, rifleSummary, type RifleProfile } from '../data/profiles.ts'
import { getData, updateData } from '../data/store.ts'
import { FACTORY_LOADS, loadName } from '../library/ammo.ts'
import { renderFactoryPicker } from './factoryPicker.ts'
import { escapeHtml } from './format.ts'
import { parseFormValues, readFormValues, renderShotFields, toFormValues, updateVisibility } from './shotForm.ts'

export function renderRiflesPage(root: HTMLElement, param?: string): void {
  const profile = getData().profiles.find((p) => p.id === param)
  if (profile) renderEditor(root, profile)
  else renderList(root)
}

function addRifle(from?: RifleProfile): string {
  const id = newId()
  updateData((d) => {
    d.profiles.push({
      id,
      name: from ? `${from.name} (copy)` : `Rifle ${d.profiles.length + 1}`,
      notes: from?.notes,
      rifle: { ...(from?.rifle ?? DEFAULT_RIFLE) },
      factory: from?.factory ? { ...from.factory } : undefined,
      updatedAt: new Date().toISOString(),
    })
  })
  return id
}

function renderList(root: HTMLElement): void {
  const d = getData()
  root.innerHTML = `
    <section class="card">
      <h2>Rifles</h2>
      <p>Your saved rifles and loads. The weather is set on the Shoot screen and shared by all rifles.</p>
      <button class="primary big-button" data-action="add">Add rifle</button>
    </section>
    <ul class="case-list">
      ${
        d.profiles.length
          ? d.profiles
              .map(
                (p) => `<li class="card"><a href="#/rifles/${p.id}">
                  <strong>${escapeHtml(p.name)}</strong>${p.id === d.shoot.profileId ? '<span class="badge good">on Shoot</span>' : ''}<br />
                  <small>${escapeHtml(rifleSummary(p.rifle))}</small></a></li>`,
              )
              .join('')
          : '<li><small>No rifles yet. Tap Add rifle.</small></li>'
      }
    </ul>`
  root.querySelector('[data-action="add"]')!.addEventListener('click', () => {
    location.hash = `#/rifles/${addRifle()}`
  })
}

/** Note at the top of a rifle filled from the library. */
function factoryBanner(p: RifleProfile): string {
  const load = p.factory && FACTORY_LOADS.find((l) => l.id === p.factory!.loadId)
  if (!p.factory || !load) return ''
  const barrel = p.factory.barrelIn ? ` for a ${p.factory.barrelIn}″ barrel` : ''
  return `<p class="card factory-banner"><small>Filled from <strong>${escapeHtml(loadName(load))}</strong>${barrel}.
    ${p.factory.mvEstimated ? 'Muzzle velocity is an <strong>estimate</strong> — log confirmed hits to true it.' : 'Muzzle velocity has since been trued or entered by you.'}</small></p>`
}

function renderEditor(root: HTMLElement, p: RifleProfile): void {
  const d = getData()
  root.innerHTML = `
    <p><a href="#/rifles">&larr; All rifles</a></p>
    <section class="card group">
      <label class="field"><span>Name</span><input name="profileName" type="text" value="${escapeHtml(p.name)}" /></label>
      <label class="field"><span>Notes</span><input name="profileNotes" type="text" value="${escapeHtml(p.notes ?? '')}" placeholder="optional" /></label>
    </section>
    ${factoryBanner(p)}
    <button class="big-button" data-action="factory">⇩ Fill from factory ammo</button>
    <div data-factory></div>
    <form class="shot-form" novalidate>${renderShotFields(toFormValues(combine(p.rifle, d.conditions, d.shoot)), false, ['rifle'])}</form>
    <ul class="errors" data-errors></ul>
    <p class="saved-note"><small>Changes save automatically.</small></p>
    <section class="card actions">
      <button class="primary big-button" data-action="use">Use on Shoot</button>
      <button data-action="duplicate">Duplicate</button>
      <button class="danger" data-action="delete">Delete</button>
    </section>`

  const form = root.querySelector<HTMLFormElement>('form')!
  const errorsBox = root.querySelector<HTMLUListElement>('[data-errors]')!
  const text = (name: string) => root.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value.trim()

  function saveEdits(e: Event) {
    // The factory ammo picker has its own boxes; they don't edit the rifle directly.
    if ((e.target as HTMLElement).closest('[data-factory]')) return
    const values = readFormValues(form, ['rifle'])
    updateVisibility(form, values, ['rifle'])
    const { inputs, errors } = parseFormValues(values, ['rifle'])
    errorsBox.innerHTML = errors.map((er) => `<li>${escapeHtml(er)}</li>`).join('')
    updateData((data) => {
      const target = data.profiles.find((x) => x.id === p.id)
      if (!target) return
      target.name = text('profileName') || 'Unnamed rifle'
      target.notes = text('profileNotes') || undefined
      // Only store the rifle numbers once they are all valid.
      if (inputs) {
        // Typing your own velocity means it's no longer the library estimate.
        if (target.factory?.mvEstimated && inputs.muzzleVelocityFps !== target.rifle.muzzleVelocityFps) {
          target.factory.mvEstimated = false
        }
        target.rifle = rifleOf(inputs)
      }
      target.updatedAt = new Date().toISOString()
    })
  }

  root.addEventListener('input', saveEdits)
  root.addEventListener('change', saveEdits)

  root.querySelector('[data-action="factory"]')!.addEventListener('click', () => {
    const current = getData().profiles.find((x) => x.id === p.id) ?? p
    renderFactoryPicker(root.querySelector<HTMLElement>('[data-factory]')!, p.id, current.factory?.barrelIn, () => {
      renderEditor(root, getData().profiles.find((x) => x.id === p.id) ?? p)
    })
  })

  root.querySelector('[data-action="use"]')!.addEventListener('click', () => {
    updateData((data) => {
      data.shoot.profileId = p.id
    })
    location.hash = '#/shoot'
  })
  root.querySelector('[data-action="duplicate"]')!.addEventListener('click', () => {
    const current = getData().profiles.find((x) => x.id === p.id) ?? p
    location.hash = `#/rifles/${addRifle(current)}`
  })
  root.querySelector('[data-action="delete"]')!.addEventListener('click', () => {
    const name = getData().profiles.find((x) => x.id === p.id)?.name ?? p.name
    if (!confirm(`Delete "${name}"? This can't be undone (unless you exported a backup).`)) return
    updateData((data) => {
      data.profiles = data.profiles.filter((x) => x.id !== p.id)
      if (data.shoot.profileId === p.id) data.shoot.profileId = data.profiles[0]?.id
    })
    location.hash = '#/rifles'
  })
}
