import './style.css'

// Placeholder screen. Real features are added in later steps.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <h1>PRS Ballistics</h1>
  <p>Ballistic calculator for PRS, NRL and rimfire. Coming soon.</p>
</main>
<footer>
  <p>Results are estimates. Always confirm your data on paper and steel.</p>
  <a href="${import.meta.env.BASE_URL}licenses/">Licenses &amp; disclaimer</a>
  <span class="version">v${__APP_VERSION__}</span>
</footer>
`
