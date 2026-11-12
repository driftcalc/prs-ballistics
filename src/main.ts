import './design/tokens.css'
import './design/components.css'
import './style.css'
import { tabBar } from './design/components.ts'
import { getData, SAVE_STATUS_EVENT, updateData } from './data/store.ts'
import { renderAccuracyPage } from './ui/accuracyPage.ts'
import { renderDataPage } from './ui/dataPage.ts'
import { renderLogPage } from './ui/logPage.ts'
import { renderMatchPage } from './ui/matchPage.ts'
import { renderRangeCardPage } from './ui/rangeCardPage.ts'
import { renderRiflesPage } from './ui/riflesPage.ts'
import { backupOverdue, isInstalled, requestPersistentStorage } from './ui/safety.ts'
import { openSettings } from './ui/settingsSheet.ts'
import { renderShootPage } from './ui/shootPage.ts'
import { renderStyleguidePage } from './ui/styleguidePage.ts'
import { TABS } from './ui/tabs.ts'
import { applyTheme, followPhoneTheme } from './ui/theme.ts'

interface Page {
  title: string
  render: (root: HTMLElement, param?: string) => void
  /** Field screens (used on the line) get 18px text instead of 16px. */
  field?: boolean
}

// Shoot, Match, Log and Rifles are the tabs. The range card opens from Rifles and Shoot;
// Check and Data open from Settings;
// the style guide is only reachable by typing #/styleguide.
const PAGES: Record<string, Page> = {
  shoot: { title: 'Shoot', render: renderShootPage, field: true },
  match: { title: 'Match', render: renderMatchPage, field: true },
  log: { title: 'Log', render: renderLogPage, field: true },
  rifles: { title: 'Rifles', render: renderRiflesPage },
  card: { title: 'Range card', render: renderRangeCardPage, field: true },
  check: { title: 'Check accuracy', render: renderAccuracyPage },
  data: { title: 'Data & backup', render: renderDataPage },
  styleguide: { title: 'Style guide', render: renderStyleguidePage },
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header class="appbar">
  <h1 class="appbar-title" data-page-title>Spin Drift</h1>
  <button class="btn appbar-btn" type="button" data-action="settings" aria-label="Settings">⚙</button>
</header>
<div data-banners></div>
<main id="page"></main>
<footer class="appfoot">
  <p>Results are estimates. Always confirm your data on paper and steel.</p>
  <p><a href="${import.meta.env.BASE_URL}licenses/">Licenses &amp; disclaimer</a> · v${__APP_VERSION__}</p>
</footer>
<div class="tabbar-dock" data-tabbar></div>
`

document.querySelector('[data-action="settings"]')!.addEventListener('click', () => openSettings(showPage))

/** Tips that protect your data: install the app, and a dot on ⚙ when a backup is due. */
function showSafetyHints() {
  const d = getData()
  document.querySelector('[data-action="settings"]')?.toggleAttribute('data-due', backupOverdue(d))
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
        iPhone: Share ⎋ → Add to Home Screen. Android: ⋮ menu → Install app.</p>
      <button class="btn" type="button" data-action="dismiss-install">Got it</button>
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
  const page = PAGES[pageId]
  document.querySelector('[data-page-title]')!.textContent = pageId === 'shoot' ? 'Spin Drift' : page.title
  document.querySelector('[data-tabbar]')!.innerHTML = tabBar(TABS, pageId)
  const root = document.querySelector<HTMLElement>('#page')!
  const fresh = root.cloneNode(false) as HTMLElement // drops old page's listeners
  fresh.classList.toggle('field-screen', page.field === true)
  root.replaceWith(fresh)
  page.render(fresh, param)
  showSafetyHints()
  window.scrollTo(0, 0)
}

requestPersistentStorage()
applyTheme()
followPhoneTheme()
window.addEventListener('hashchange', showPage)
showPage()
