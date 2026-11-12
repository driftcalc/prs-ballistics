// Rifles: the list (active rifle marked, Use and Range card on each) and the
// editor, grouped into Rifle, Scope, Load and Zero with the advanced boxes
// under "More". Edits save as you type.
import { combine, DEFAULT_RIFLE, newId, rifleOf, rifleSummary, type RifleProfile } from '../data/profiles.ts'
import { getData, updateData } from '../data/store.ts'
import { FACTORY_LOADS, loadName } from '../library/ammo.ts'
import { renderFactoryPicker } from './factoryPicker.ts'
import { escapeHtml } from './format.ts'
import { parseFormValues, readFormValues, renderFieldsByKey, showFieldErrors, toFormValues, updateVisibility } from './shotForm.ts'

// Last deleted rifle, for Undo (kept until another rifle is deleted or the app closes).
let deleted: { profile: RifleProfile; index: number; wasActive: boolean; at: number } | undefined
const UNDO_MS = 8000

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
  const activeId = d.profiles.find((p) => p.id === d.shoot.profileId)?.id ?? d.profiles[0]?.id
  const undo = deleted && Date.now() - deleted.at < UNDO_MS ? deleted : undefined
  root.innerHTML = `
    ${
      undo
        ? `<div class="banner" role="status" data-undo-banner><p>Deleted “${escapeHtml(undo.profile.name)}”.</p>
            <button class="btn" type="button" data-action="undo">Undo</button></div>`
        : ''
    }
    <button class="btn btn-primary big-button" type="button" data-action="add">+ Add rifle</button>
    ${
      d.profiles.length
        ? `<ul class="rifle-list">${d.profiles
            .map((p) => {
              const active = p.id === activeId
              return `<li class="rifle-item${active ? ' active' : ''}">
            <a class="btn rifle-open" href="#/rifles/${p.id}">
              <span class="rifle-name"><strong>${escapeHtml(p.name)}</strong>${active ? '<span class="active-mark">● Active</span>' : ''}</span>
              <span>${escapeHtml(rifleSummary(p.rifle))}</span></a>
            <div class="rifle-actions">
              ${active ? '<span class="btn rifle-using" aria-disabled="true">On Shoot</span>' : `<button class="btn" type="button" data-use="${p.id}">Use</button>`}
              <a class="btn" href="#/card/${p.id}">Range card</a>
            </div></li>`
            })
            .join('')}</ul>`
        : '<p>No rifles yet. Tap <strong>+ Add rifle</strong>.</p>'
    }
    <p class="hint">The weather is set on the Shoot screen and shared by all rifles.</p>`

  if (undo) setTimeout(() => root.querySelector('[data-undo-banner]')?.remove(), UNDO_MS - (Date.now() - undo.at))

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    if (btn.dataset.action === 'add') {
      location.hash = `#/rifles/${addRifle()}`
      return
    }
    if (btn.dataset.use) {
      updateData((data) => void (data.shoot.profileId = btn.dataset.use))
      return renderList(freshRoot(root))
    }
    if (btn.dataset.action === 'undo' && deleted) {
      const { profile, index, wasActive } = deleted
      deleted = undefined
      updateData((data) => {
        if (!data.profiles.some((p) => p.id === profile.id)) data.profiles.splice(Math.min(index, data.profiles.length), 0, profile)
        if (wasActive) data.shoot.profileId = profile.id
      })
      renderList(freshRoot(root))
    }
  })
}

/** Swaps in an empty copy of the page root so old click handlers don't pile up. */
function freshRoot(root: HTMLElement): HTMLElement {
  const fresh = root.cloneNode(false) as HTMLElement
  root.replaceWith(fresh)
  return fresh
}

/** Note at the top of a rifle filled from the library. */
function factoryBanner(p: RifleProfile): string {
  const load = p.factory && FACTORY_LOADS.find((l) => l.id === p.factory!.loadId)
  if (!p.factory || !load) return ''
  const barrel = p.factory.barrelIn ? ` for a ${p.factory.barrelIn}″ barrel` : ''
  return `<p class="factory-banner">Filled from <strong>${escapeHtml(loadName(load))}</strong>${barrel}.
    ${p.factory.mvEstimated ? 'Muzzle velocity is an <strong>estimate</strong> — log confirmed hits to true it.' : 'Muzzle velocity has since been trued or entered by you.'}</p>`
}

const more = (summary: string, body: string) =>
  `<details class="more"><summary class="btn">${summary}</summary><div class="more-body">${body}</div></details>`

function renderEditor(root: HTMLElement, p: RifleProfile): void {
  const d = getData()
  const values = toFormValues(combine(p.rifle, d.conditions, d.shoot))
  root.innerHTML = `
    <a class="btn back-link" href="#/rifles">← All rifles</a>
    <div class="rifle-editor" data-editor>
      <section class="card">
        <h2 class="card-title">Rifle</h2>
        <label class="field"><span>Name</span><input name="profileName" type="text" autocomplete="off" value="${escapeHtml(p.name)}" /></label>
        ${more(
          'More: notes, twist',
          `<label class="field"><span>Notes</span><input name="profileNotes" type="text" value="${escapeHtml(p.notes ?? '')}" placeholder="optional" /></label>
          ${renderFieldsByKey(['twistIn', 'twistDirection'], values)}`,
        )}
      </section>
      <section class="card">
        <h2 class="card-title">Scope</h2>
        ${renderFieldsByKey(['sightHeightIn'], values)}
      </section>
      <section class="card">
        <h2 class="card-title">Load</h2>
        ${factoryBanner(p)}
        <button class="btn" type="button" data-action="factory">⇩ Fill from factory ammo</button>
        <div data-factory></div>
        ${renderFieldsByKey(['muzzleVelocityFps', 'bc', 'dragModel', 'bulletWeightGr'], values)}
        ${more('More: bullet size (spin drift)', renderFieldsByKey(['bulletDiameterIn', 'bulletLengthIn'], values))}
      </section>
      <section class="card">
        <h2 class="card-title">Zero</h2>
        ${renderFieldsByKey(['zeroRangeYd'], values)}
      </section>
    </div>
    <p class="hint">Changes save automatically.</p>
    <div class="rifle-editor-actions">
      <button class="btn btn-primary big-button" type="button" data-action="use">Use on Shoot</button>
      <a class="btn" href="#/card/${p.id}">Range card</a>
      <button class="btn" type="button" data-action="duplicate">Duplicate</button>
      <button class="btn btn-danger" type="button" data-action="delete">Delete</button>
    </div>`

  const editor = root.querySelector<HTMLElement>('[data-editor]')!
  const text = (name: string) => root.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value.trim()

  function saveEdits(e: Event) {
    // The factory ammo picker has its own boxes; they don't edit the rifle directly.
    if ((e.target as HTMLElement).closest('[data-factory]')) return
    const vals = readFormValues(editor, ['rifle'])
    updateVisibility(editor, vals, ['rifle'])
    const { inputs, fieldErrors } = parseFormValues(vals, ['rifle'])
    showFieldErrors(editor, fieldErrors)
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

  editor.addEventListener('input', saveEdits)
  editor.addEventListener('change', saveEdits)

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    switch (btn?.dataset.action) {
      case 'factory': {
        const current = getData().profiles.find((x) => x.id === p.id) ?? p
        return renderFactoryPicker(root.querySelector<HTMLElement>('[data-factory]')!, p.id, current.factory?.barrelIn, () => {
          renderEditor(freshRoot(root), getData().profiles.find((x) => x.id === p.id) ?? p)
        })
      }
      case 'use':
        updateData((data) => void (data.shoot.profileId = p.id))
        location.hash = '#/shoot'
        return
      case 'duplicate': {
        const current = getData().profiles.find((x) => x.id === p.id) ?? p
        location.hash = `#/rifles/${addRifle(current)}`
        return
      }
      case 'delete':
        // No "are you sure?" pop-up: the list offers Undo for a few seconds instead.
        updateData((data) => {
          const index = data.profiles.findIndex((x) => x.id === p.id)
          if (index < 0) return
          const wasActive = data.shoot.profileId === p.id
          deleted = { profile: data.profiles[index], index, wasActive, at: Date.now() }
          data.profiles.splice(index, 1)
          if (wasActive) data.shoot.profileId = data.profiles[0]?.id
        })
        location.hash = '#/rifles'
    }
  })

  // Show any existing problems straight away (e.g. a rifle imported with odd numbers).
  showFieldErrors(editor, parseFormValues(readFormValues(editor, ['rifle']), ['rifle']).fieldErrors)
}
