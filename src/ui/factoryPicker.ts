// "Fill from factory ammo": pick a load from the library, enter your barrel
// length, preview the estimated velocity, and only then fill the rifle.
import { updateData } from '../data/store.ts'
import { FACTORY_LOADS, loadName, searchLoads, type FactoryLoad } from '../library/ammo.ts'
import { estimateVelocity, FPS_PER_INCH, MAX_BARREL_IN, MIN_BARREL_IN } from '../library/barrelEstimate.ts'
import { escapeHtml } from './format.ts'

export function renderFactoryPicker(box: HTMLElement, profileId: string, lastBarrelIn: number | undefined, onApplied: () => void): void {
  let chosen: FactoryLoad | undefined

  box.innerHTML = `
    <section class="card stack factory">
      <h2>Fill from factory ammo</h2>
      <small>Makers' published figures. Brand names are trademarks of their owners; no endorsement implied.</small>
      <label class="field big"><span>Search brand, cartridge or weight</span>
        <input name="factorySearch" type="search" autocomplete="off" placeholder="e.g. hornady 6.5 or 175 308" /></label>
      <ul class="factory-list" data-results></ul>
      <div data-preview></div>
      <button class="big-button" data-action="factory-cancel">Cancel</button>
    </section>`

  const $ = <T extends HTMLElement>(sel: string) => box.querySelector<T>(sel)!
  const searchBox = $<HTMLInputElement>('[name="factorySearch"]')

  function showResults() {
    const found = searchLoads(searchBox.value)
    $('[data-results]').innerHTML = found.length
      ? found
          .map(
            (l) => `<li><button class="factory-item${chosen?.id === l.id ? ' chosen' : ''}" data-load="${l.id}">
              <strong>${escapeHtml(l.brand)} ${escapeHtml(l.product)}</strong><br />
              <small>${escapeHtml(l.cartridge)} · ${l.muzzleVelocityFps} fps (${l.testBarrelIn}″ test barrel) · ${l.dragModel} ${l.bc.toFixed(3)}</small>
            </button></li>`,
          )
          .join('')
      : '<li><small>No loads match. The library will grow over time.</small></li>'
  }

  function showPreview() {
    if (!chosen) {
      $('[data-preview]').innerHTML = ''
      return
    }
    const l = chosen
    const barrelText = box.querySelector<HTMLInputElement>('[name="factoryBarrel"]')?.value ?? (lastBarrelIn ? String(lastBarrelIn) : '')
    const barrel = barrelText.trim() === '' ? undefined : Number(barrelText)
    const est = estimateVelocity(l, barrel)
    const per = FPS_PER_INCH[l.cartridge]
    $('[data-preview]').innerHTML = `
      <div class="factory-preview stack">
        <h3>${escapeHtml(loadName(l))}</h3>
        <label class="field big"><span>Your barrel length <small>(in, ${MIN_BARREL_IN}–${MAX_BARREL_IN}; blank = use published speed)</small></span>
          <input name="factoryBarrel" type="text" inputmode="decimal" value="${escapeHtml(barrelText)}" placeholder="e.g. 24" /></label>
        <p class="estimate"><strong>${est.adjusted ? '≈ ' : ''}${est.fps} fps</strong> (±${est.plusMinus})
          ${est.adjusted ? `— <em>estimate</em> for your ${est.barrelIn}″ barrel` : `— published, from a ${l.testBarrelIn}″ test barrel`}</p>
        <small>${
          est.adjusted
            ? `Published ${l.muzzleVelocityFps} fps from a ${l.testBarrelIn}″${l.testBarrelAssumed ? ' (assumed)' : ''} test barrel, ` +
              `adjusted about ${per.fpsPerInch} fps per inch. ${escapeHtml(per.source)}`
            : `${l.testBarrelAssumed ? "The maker doesn't state its test barrel; 24″ assumed. " : ''}Real rifles often differ by 50 fps or more.`
        }${est.clamped ? ' Barrel length kept within the allowed range.' : ''}
          Log confirmed hits to true it.</small>
        <table class="compare"><tbody>
          <tr><td>BC</td><td>${l.dragModel} ${l.bc.toFixed(3)}</td></tr>
          <tr><td>Bullet weight</td><td>${l.bulletWeightGr} gr</td></tr>
          <tr><td>Bullet diameter</td><td>${l.bulletDiameterIn} in</td></tr>
          <tr><td>Bullet length</td><td>${l.bulletLengthIn ? `${l.bulletLengthIn} in` : 'not published (spin drift off)'}</td></tr>
        </tbody></table>
        ${l.note ? `<small>${escapeHtml(l.note)}</small>` : ''}
        <small>Source: <a href="${escapeHtml(l.source)}" target="_blank" rel="noopener">maker's page</a> (checked ${l.checked}).
          Sight height, zero and twist are not changed.</small>
        <button class="primary big-button" data-action="factory-use">Use these values</button>
      </div>`
    const barrelBox = $<HTMLInputElement>('[name="factoryBarrel"]')
    barrelBox.addEventListener('input', () => {
      const pos = barrelBox.selectionStart
      showPreview()
      const again = $<HTMLInputElement>('[name="factoryBarrel"]')
      again.focus()
      if (pos !== null) again.setSelectionRange(pos, pos)
    })
    $('[data-action="factory-use"]').addEventListener('click', () => {
      updateData((data) => {
        const p = data.profiles.find((x) => x.id === profileId)
        if (!p) return
        p.rifle = {
          ...p.rifle,
          muzzleVelocityFps: est.fps,
          bc: l.bc,
          dragModel: l.dragModel,
          bulletWeightGr: l.bulletWeightGr,
          bulletDiameterIn: l.bulletDiameterIn,
          // Don't keep a length that belonged to a different bullet.
          bulletLengthIn: l.bulletLengthIn,
        }
        p.factory = { loadId: l.id, barrelIn: est.adjusted || barrel !== undefined ? est.barrelIn : undefined, mvEstimated: true }
        p.updatedAt = new Date().toISOString()
      })
      onApplied()
    })
  }

  box.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-load]')
    if (item) {
      chosen = FACTORY_LOADS.find((l) => l.id === item.dataset.load)
      showResults()
      showPreview()
      $('[data-preview]').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if ((e.target as HTMLElement).closest('[data-action="factory-cancel"]')) box.innerHTML = ''
  })
  searchBox.addEventListener('input', showResults)
  showResults()
  searchBox.focus()
}
