import './style.css'
import { renderAccuracyPage } from './ui/accuracyPage.ts'
import { renderCalculatorPage } from './ui/calculatorPage.ts'
import { renderRiflesPage } from './ui/riflesPage.ts'

const PAGES: Record<string, { title: string; render: (root: HTMLElement, param?: string) => void }> = {
  calculator: { title: 'Calculator', render: renderCalculatorPage },
  rifles: { title: 'Rifles', render: renderRiflesPage },
  check: { title: 'Check accuracy', render: renderAccuracyPage },
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header>
  <h1>PRS Ballistics</h1>
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

// Simple page switching using the part of the address after '#'.
function showPage() {
  const [id, param] = location.hash.replace('#/', '').split('/')
  const pageId = id in PAGES ? id : 'calculator'
  document.querySelectorAll<HTMLAnchorElement>('.tabs a').forEach((a) => {
    a.toggleAttribute('aria-current', a.dataset.page === pageId)
  })
  const root = document.querySelector<HTMLElement>('#page')!
  const fresh = root.cloneNode(false) as HTMLElement // drops old page's listeners
  root.replaceWith(fresh)
  PAGES[pageId].render(fresh, param)
  window.scrollTo(0, 0)
}

window.addEventListener('hashchange', showPage)
showPage()
