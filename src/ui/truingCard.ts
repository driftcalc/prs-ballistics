// Truing assistant card on the Log tab. Shows the verdict and working, and
// offers to apply the suggested value — only after you confirm.
import { getData, updateData } from '../data/store.ts'
import { analyseTruing, truingPoints, type Suggestion } from '../truing/truing.ts'
import { milToRadians, radiansToMoa } from '../units/index.ts'
import { escapeHtml } from './format.ts'

const label = (s: Suggestion) => (s.field === 'muzzleVelocityFps' ? 'muzzle velocity' : 'BC')
const value = (s: Suggestion, v: number) => (s.field === 'muzzleVelocityFps' ? `${v} fps` : v.toFixed(3))

export function renderTruingCard(box: HTMLElement, profileId: string, onApplied: () => void): void {
  const d = getData()
  const profile = d.profiles.find((p) => p.id === profileId)
  if (!profile) return
  const unit = d.settings.angleUnit
  const show = (mil: number) => (unit === 'mil' ? mil : radiansToMoa(milToRadians(mil))).toFixed(unit === 'mil' ? 2 : 1)
  const points = truingPoints(d.log, profileId)

  box.innerHTML = `<section class="card truing"><h2>Truing assistant</h2><p data-status>Checking ${points.length} confirmed hold${
    points.length === 1 ? '' : 's'
  }…</p></section>`

  void (async () => {
    let r
    try {
      r = await analyseTruing(profile.rifle, points)
    } catch (e) {
      box.querySelector('[data-status]')!.textContent = `Couldn't analyse these holds: ${(e as Error).message}`
      return
    }
    const s = r.suggestion
    const table = r.rows.length
      ? `<table class="compare"><thead><tr><th>Yd</th><th>You held</th><th>Predicted</th>${s ? '<th>With fix</th>' : ''}</tr></thead><tbody>
          ${r.rows
            .map(
              (row) => `<tr><td>${row.rangeYd}</td><td>${show(row.actualMil)}</td><td>${show(row.currentMil)}</td>${
                s ? `<td>${row.suggestedMil === undefined ? '' : show(row.suggestedMil)}</td>` : ''
              }</tr>`,
            )
            .join('')}
        </tbody></table><small>Elevation in ${unit === 'mil' ? 'mil' : 'MOA'}. Windage isn't trued — wind is too uncertain to learn from.</small>`
      : ''

    box.innerHTML = `
      <section class="card truing stack">
        <h2>Truing assistant</h2>
        <p class="truing-headline verdict-${r.verdict}"><strong>${escapeHtml(r.headline)}</strong></p>
        <p>${escapeHtml(r.explanation)}</p>
        ${r.warning ? `<p class="truing-warning">⚠ ${escapeHtml(r.warning)}</p>` : ''}
        ${table}
        ${
          s
            ? `<button class="primary big-button" data-action="apply">Apply ${label(s)} ${value(s, s.suggested)} to “${escapeHtml(profile.name)}”</button>
               <small>Your rifle is not changed unless you tap this and confirm.</small>`
            : ''
        }
      </section>`

    box.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
      if (!s) return
      const ok = confirm(
        `Change ${label(s)} on "${profile.name}" from ${value(s, s.current)} to ${value(s, s.suggested)}?\n\n` +
          'The old value is saved in the rifle notes so you can change it back.',
      )
      if (!ok) return
      updateData((data) => {
        const p = data.profiles.find((x) => x.id === profileId)
        if (!p) return
        p.rifle = { ...p.rifle, [s.field]: s.suggested }
        // A trued velocity replaces the factory-library estimate.
        if (s.field === 'muzzleVelocityFps' && p.factory) p.factory.mvEstimated = false
        const note = `Trued ${label(s)} ${value(s, s.current)} → ${value(s, s.suggested)} on ${new Date().toLocaleDateString()}.`
        p.notes = p.notes ? `${p.notes} ${note}` : note
        p.updatedAt = new Date().toISOString()
      })
      onApplied()
    })
  })()
}
