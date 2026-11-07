import './design/tokens.css'
import './design/components.css'
import './style.css'
import { getData, SAVE_STATUS_EVENT, updateData } from './data/store.ts'
import { renderAccuracyPage } from './ui/accuracyPage.ts'
import { renderDataPage } from './ui/dataPage.ts'
import { renderLogPage } from './ui/logPage.ts'
import { applyTheme, followPhoneTheme } from './ui/theme.ts'
import { renderRiflesPage } from './ui/riflesPage.ts'
import { backupOverdue, isInstalled, requestPersistentStorage } from './ui/safety.ts'
import { renderShootPage } from './ui/shootPage.ts'
import { renderStyleguidePage } from './ui/styleguidePage.ts'

const PAGES: Record<string, { title: string; render: (root: HTMLElement, param?: string) => void; hidden?: boolean }> = {
  shoot: { title: 'Shoot', render: renderShootPage },
  rifles: { title: 'Rifles', render: renderRiflesPage },
  log: { title: 'Log', render: renderLogPage },
  check: { title: 'Check', render: renderAccuracyPage },
  data: { title: 'Data', render: renderDataPage },
  styleguide: { title: 'Style guide', render: renderStyleguidePage, hidden: true },
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header>
  <div class="title-row">
    <h1>Spin Drift</h1>
    <button class="night-toggle" data-action="night" aria-label="Night mode">☾</button>
  </div>
  <nav class="tabs">
    ${Object.entries(PAGES)
      .filter(([, p]) => !p.hidden)
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
  // Temporary until the Settings sheet: the moon button switches Night on/off.
  updateData((d) => void (d.settings.theme = d.settings.theme === 'night' ? 'auto' : 'night'))
  applyTheme()
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

// Right after an app update, a copy that was already open may ask for a file
// from the previous version that no longer exists (e.g. the ballistics engine).
// Reload once to pick up the new version. Saved data is untouched (everything is
// saved as you go). The time check stops a reload loop if the problem is something else.
const RELOAD_KEY = 'spin-drift:reloaded-for-update'
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }
  e.preventDefault()
  location.reload()
})

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
applyTheme()
followPhoneTheme()
window.addEventListener('hashchange', showPage)
showPage()
