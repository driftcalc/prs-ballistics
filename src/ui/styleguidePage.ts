// Hidden style guide (#/styleguide): every component in Sun, Dark and Night,
// so the design can be reviewed on a real phone. Not linked from the tab bar.
// The controls work, but nothing here is saved.
import { card, chipRow, clockDial, openSheet, readout, readoutPair, segmented, setClock, setSelected, stepper, tabBar } from '../design/components.ts'
import { stageCardHtml, type CardView } from './stageCard.ts'
import { TABS } from './tabs.ts'

/** Made-up holds, just to show the stage card layout. */
const SAMPLE_CARD: CardView = {
  stageName: 'Stage 3 · Barricade',
  index: 3,
  total: 12,
  rifleName: '6.5 CM',
  conditions: '59°F · 29.92 inHg · 0% RH',
  unitLabel: 'MIL',
  modeLabel: 'DIAL',
  rows: [
    { name: 'T1', rangeYd: 611, elev: 'UP 4.1', winds: [{ mph: 5, left: 'L 0.7', right: 'R 0.5' }, { mph: 10, left: 'L 1.3', right: 'R 1.0' }] },
    { name: 'PLATE', rangeYd: 1012, elev: 'UP 10.6', winds: [{ mph: 5, left: 'L 1.4', right: 'R 1.0' }, { mph: 10, left: 'L 2.8', right: 'R 2.3' }] },
  ],
  order: ['T1', 'PLATE', 'T1'],
}

const THEMES = [
  ['sun', 'Sun'],
  ['dark', 'Dark'],
  ['night', 'Night'],
] as const

function panel(theme: string, title: string): string {
  return `<section class="sg-panel" data-theme="${theme}">
    <h2 class="sg-theme">${title}</h2>

    <h3>Read-out pair</h3>
    ${readoutPair(
      readout({ id: `${theme}-elev`, label: 'Elev', dir: 'UP', value: '4.6', unit: 'MIL' }),
      readout({ id: `${theme}-wind`, label: 'Wind', dir: 'L', value: '1.1', unit: 'MIL' }),
    )}
    <h3>Read-out pair, long value (stacks)</h3>
    ${readoutPair(
      readout({ id: `${theme}-elev2`, label: 'Elev', dir: 'UP', value: '143.1', unit: 'MOA' }),
      readout({ id: `${theme}-wind2`, label: 'Wind', dir: 'R', value: '24.3', unit: 'MOA' }),
    )}

    <h3>Big stepper</h3>
    ${stepper({ name: `${theme}-range`, label: 'Range', value: '600', unit: 'yd' })}

    <h3>Chip row</h3>
    ${chipRow({ name: `${theme}-step`, label: 'Step', selected: '25', options: ['10', '25', '50', '100'].map((v) => ({ value: v, label: `±${v}` })) })}

    <h3>Segmented toggle</h3>
    ${segmented({ name: `${theme}-unit`, label: 'Units', selected: 'mil', options: [{ value: 'mil', label: 'MIL' }, { value: 'moa', label: 'MOA' }] })}

    <h3>Clock dial (wind from)</h3>
    <div data-sg-clock>${clockDial({ label: 'Wind from', selected: 3 })}</div>

    <h3>Stage card</h3>
    ${stageCardHtml(SAMPLE_CARD)}

    <h3>Buttons</h3>
    <div class="sg-row">
      <button class="btn btn-primary" type="button">Primary</button>
      <button class="btn" type="button">Normal</button>
      <button class="btn btn-danger" type="button">Delete</button>
    </div>
    <p class="sg-note">Press and hold any button: it inverts instantly.</p>

    <h3>Card</h3>
    ${card('<p class="sg-p">Body text is 16px minimum; 18px on field screens. Numbers use fixed-width digits: 1111 / 8888 and a slashed zero: 0.</p><p class="sg-p" style="color: var(--text-2)">Secondary text.</p><p class="sg-p" style="color: var(--danger)">⚠ Danger text.</p><p class="sg-p" style="color: var(--good)">✓ Good text.</p>', { title: 'Card title' })}

    <h3>Bottom sheet</h3>
    <button class="btn" type="button" data-sg-sheet="${theme}">Open bottom sheet</button>

    <h3>Bottom tab bar</h3>
    <div class="sg-tabbar">${tabBar(TABS, 'shoot')}</div>
  </section>`
}

export function renderStyleguidePage(root: HTMLElement): void {
  const htmlEl = document.documentElement
  root.innerHTML = `
    <section class="card">
      <h2 class="card-title">Style guide</h2>
      <p class="sg-p">Every component in all three themes. Preview switches below change this page only and aren't saved.</p>
      <div class="sg-row">
        <button class="btn" type="button" data-sg-toggle="data-glove" aria-pressed="${htmlEl.hasAttribute('data-glove')}">Glove mode</button>
        <button class="btn" type="button" data-sg-toggle="data-lefthand" aria-pressed="${htmlEl.hasAttribute('data-lefthand')}">Left-handed</button>
      </div>
    </section>
    ${THEMES.map(([t, title]) => panel(t, title)).join('')}`

  const initial = { glove: htmlEl.hasAttribute('data-glove'), left: htmlEl.hasAttribute('data-lefthand') }
  // Put the real settings back when leaving the page.
  window.addEventListener(
    'hashchange',
    () => {
      htmlEl.toggleAttribute('data-glove', initial.glove)
      htmlEl.toggleAttribute('data-lefthand', initial.left)
    },
    { once: true },
  )

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    if (btn.dataset.sgToggle) {
      const on = !htmlEl.hasAttribute(btn.dataset.sgToggle)
      htmlEl.toggleAttribute(btn.dataset.sgToggle, on)
      btn.setAttribute('aria-pressed', String(on))
    }
    if (btn.dataset.chip) setSelected(root, 'data-chip', btn.dataset.chip, btn.dataset.value!)
    if (btn.dataset.segment) setSelected(root, 'data-segment', btn.dataset.segment, btn.dataset.value!)
    if (btn.dataset.clock) setClock(btn.closest('[data-sg-clock]')!, Number(btn.dataset.clock))
    if (btn.dataset.stepper) {
      const el = root.querySelector(`[data-stepper-value="${btn.dataset.stepper}"]`)!
      el.textContent = String(Math.max(25, Number(el.textContent) + Number(btn.dataset.dir) * 25))
    }
    if (btn.dataset.sgSheet) {
      openSheet({
        title: 'Bottom sheet',
        theme: btn.dataset.sgSheet,
        content: `<p class="sg-p">Slides up from the bottom. Close with ✕, by tapping outside, Escape, or the phone's back gesture.</p>
          ${segmented({ name: 'sheet-demo', label: 'Demo', selected: 'a', options: [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }] })}
          <button class="btn btn-primary" type="button" data-sheet-close>Done</button>`,
      })
    }
  })
}
