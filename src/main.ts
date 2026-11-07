import './style.css'
import { getData, SAVE_STATUS_EVENT, updateData } from './data/store.ts'
import { renderAccuracyPage } from './ui/accuracyPage.ts'
import { renderDataPage } from './ui/dataPage.ts'
import { renderLogPage } from './ui/logPage.ts'
import { applyNightMode } from './ui/nightMode.ts'
import { renderRiflesPage } from './ui/riflesPage.ts'
import { backupOverdue, isInstalled, requestPersistentStorage } from './ui/safety.ts'
import { renderShootPage } from './ui/shootPage.ts'

const PAGES: Record<string, { title: string; render: (root: HTMLElement, param?: string) => void }> = {
  shoot: { title: 'Shoot', render: renderShootPage },
  rifles: { title: 'Rifles', render: renderRiflesPage },
  log: { title: 'Log', render: renderLogPage },
  check: { title: 'Check', render: renderAccuracyPage },
  data: { title: 'Data', render: renderDataPage },
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header>
  <div class="title-row">
    <h1>Spin Drift</h1>
    <button class="night-toggle" data-action="night" aria-label="Night mode">☾</button>
  </div>
  <nav class="tabs">
    ${Object.entries(PAGES)
      .map(([id, p]) => `<a href="#/${id}" data-page="${id}">${p.title}</a>`)
      .join('')}
  </nav>
  <div data-banners></div>
</header>
<main id="page"></main>
<footer>
  <p>Results are estimates. Always confirm your data on paper and steel.</p>
  <a href="${import.meta.env.BASE_URL}licenses/">Licenses &amp; disclaimer</a>
  <span class="version">v${__APP_VERSION__}</span>
</footer>
`

document.querySelector('[data-action="night"]')!.addEventListener('click', () => {
  updateData((d) => void (d.settings.night = !d.settings.night))
  applyNightMode()
})

/** Tips that protect your data: install the app, and a dot on Data when a backup is due. */
function showSafetyHints() {
  const d = getData()
  document.querySelector('.tabs a[data-page="data"]')?.toggleAttribute('data-due', backupOverdue(d))
  const box = document.querySelector<HTMLElement>('[data-banners]')!
  if (isInstalled() || d.settings.installTipDismissed) {
    box.querySelector('[data-install-tip]')?.remove()
    return
  }
  if (box.querySelector('[data-install-tip]')) return
  box.insertAdjacentHTML(
    'beforeend',
    `<div class="banner" data-install-tip>
      <p><strong>Add Spin Drift to your Home Screen.</strong> In a browser tab (especially Safari on iPhone),
        your saved rifles and logbook can be erased after about a week without use. From the Home Screen they're kept.<br />
        <small>iPhone: Share ⎋ → Add to Home Screen. Android: ⋮ menu → Install app.</small></p>
      <button data-action="dismiss-install">Got it</button>
    </div>`,
  )
  box.querySelector('[data-action="dismiss-install"]')!.addEventListener('click', () => {
    updateData((data) => void (data.settings.installTipDismissed = true))
    showSafetyHints()
  })
}

// If the phone refuses to save (storage full, private browsing), say so loudly.
window.addEventListener(SAVE_STATUS_EVENT, (e) => {
  const ok = (e as CustomEvent<{ ok: boolean }>).detail.ok
  const box = document.querySelector<HTMLElement>('[data-banners]')!
  box.querySelector('[data-save-error]')?.remove()
  if (ok) return
  box.insertAdjacentHTML(
    'afterbegin',
    `<div class="banner error" data-save-error role="alert">
      <p><strong>Couldn't save your changes on this phone.</strong> Storage may be full or you're in a private
        browsing window. Your last changes will be lost when the app closes. <a href="#/data">Export a backup now</a>.</p>
    </div>`,
  )
})

// Simple page switching using the part of the address after '#'.
function showPage() {
  const [id, param] = location.hash.replace('#/', '').split('/')
  const pageId = id in PAGES ? id : 'shoot'
  document.querySelectorAll<HTMLAnchorElement>('.tabs a').forEach((a) => {
    a.toggleAttribute('aria-current', a.dataset.page === pageId)
  })
  const root = document.querySelector<HTMLElement>('#page')!
  const fresh = root.cloneNode(false) as HTMLElement // drops old page's listeners
  root.replaceWith(fresh)
  PAGES[pageId].render(fresh, param)
  showSafetyHints()
  window.scrollTo(0, 0)
}

requestPersistentStorage()
applyNightMode()
window.addEventListener('hashchange', showPage)
showPage()
