import './style.css'
import { getData, updateData } from './data/store.ts'
import { renderAccuracyPage } from './ui/accuracyPage.ts'
import { renderRiflesPage } from './ui/riflesPage.ts'
import { renderShootPage } from './ui/shootPage.ts'

const PAGES: Record<string, { title: string; render: (root: HTMLElement, param?: string) => void }> = {
  shoot: { title: 'Shoot', render: renderShootPage },
  rifles: { title: 'Rifles', render: renderRiflesPage },
  check: { title: 'Check', render: renderAccuracyPage },
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header>
  <div class="title-row">
    <h1>PRS Ballistics</h1>
    <button class="night-toggle" data-action="night" aria-label="Night mode">☾</button>
  </div>
  <nav class="tabs">
    ${Object.entries(PAGES)
      .map(([id, p]) => `<a href="#/${id}" data-page="${id}">${p.title}</a>`)
      .join('')}
  </nav>
</header>
<main id="page"></main>
<footer>
  <p>Results are estimates. Always confirm your data on paper and steel.</p>
  <a href="${import.meta.env.BASE_URL}licenses/">Licenses &amp; disclaimer</a>
  <span class="version">v${__APP_VERSION__}</span>
</footer>
`

// Red night mode: black screen, dim red everything, so your eyes stay dark-adapted.
function applyNightMode() {
  const night = getData().settings.night
  document.documentElement.toggleAttribute('data-night', night)
  document.querySelector('.night-toggle')!.toggleAttribute('aria-pressed', night)
  // Colours the phone's status bar to match.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', night ? '#000000' : '#1b2a1f'))
}

document.querySelector('[data-action="night"]')!.addEventListener('click', () => {
  updateData((d) => void (d.settings.night = !d.settings.night))
  applyNightMode()
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
  window.scrollTo(0, 0)
}

applyNightMode()
window.addEventListener('hashchange', showPage)
showPage()
