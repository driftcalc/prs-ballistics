// Check accuracy page: type in another app's answers, see how far ours differ.
import {
  compareCase,
  emptyRows,
  flaggedRows,
  parseMil,
  RANGES_YD,
  SOURCES,
  TOLERANCE_MIL,
  validateCase,
  type ComparedRow,
  type ReferenceCase,
  type ReferenceRow,
} from '../accuracy/compare.ts'
import { getEngine } from '../ballistics/index.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { escapeHtml, signed } from './format.ts'
import { parseFormValues, readFormValues, renderShotFields, toFormValues, updateVisibility, type FormValues } from './shotForm.ts'
import { load, save } from './storage.ts'

const STORE_CASES = 'accuracy.cases'
const BUILTIN_PREFIX = 'builtin-'

// Test cases saved in the project (src/accuracy/cases) are shown as read-only examples.
const builtinFiles = import.meta.glob('../accuracy/cases/*.json', { eager: true, import: 'default' })
const builtins: Record<string, ReferenceCase> = Object.fromEntries(
  Object.entries(builtinFiles).map(([path, data]) => {
    const file = path.split('/').pop()!.replace(/\.json$/, '')
    return [BUILTIN_PREFIX + file, validateCase(data, path)]
  }),
)

const loadMine = () => load<Record<string, ReferenceCase>>(STORE_CASES, {})
const allCases = () => ({ ...builtins, ...loadMine() })

const TIPS = `
  <details class="card tips">
    <summary><strong>How to get a fair comparison</strong></summary>
    <ul>
      <li>In Hornady / AB use the plain <strong>G1 or G7 BC</strong> — not Hornady 4DOF or AB custom drag curves.</li>
      <li><strong>Turn off Coriolis</strong> (and aerodynamic jump if the app has it).</li>
      <li>Make the app's <strong>zero conditions the same</strong> as the current weather.</li>
      <li>Enter the same sight height, zero, twist, bullet length/diameter and humidity here.</li>
      <li>Type corrections as shown: <code>U 5.3</code>, <code>L 0.4</code>, <code>R 0.4</code> (or plain numbers, left = negative).</li>
    </ul>
  </details>`

export function renderAccuracyPage(root: HTMLElement, param?: string): void {
  if (param && allCases()[param]) renderEditor(root, param)
  else renderList(root)
}

// ---------- List of comparisons ----------

function renderList(root: HTMLElement): void {
  const cases = allCases()
  const ids = Object.keys(cases).sort((a, b) => (cases[b].createdAt ?? '').localeCompare(cases[a].createdAt ?? ''))
  root.innerHTML = `
    <section class="card">
      <h2>Check accuracy</h2>
      <p>Compare our answers with Hornady or Applied Ballistics at 100–1000 yd.
        Any difference over <strong>${TOLERANCE_MIL} mil</strong> is flagged red.</p>
      <button class="primary" data-action="new">New comparison</button>
    </section>
    ${TIPS}
    <ul class="case-list">
      ${
        ids.length
          ? ids
              .map(
                (id) => `<li class="card"><a href="#/check/${id}">
                  <strong>${escapeHtml(cases[id].name || 'Untitled')}</strong><span class="badge" data-badge="${id}"></span><br />
                  <small>${escapeHtml(cases[id].source)}${id.startsWith(BUILTIN_PREFIX) ? ' · saved test case' : ''}</small></a></li>`,
              )
              .join('')
          : '<li><small>No comparisons yet.</small></li>'
      }
    </ul>`

  root.querySelector('[data-action="new"]')!.addEventListener('click', () => {
    const id = Date.now().toString(36)
    const calc = parseFormValues(load<FormValues>('calc.inputs', {}))
    const mine = loadMine()
    mine[id] = {
      name: 'New comparison',
      source: 'Hornady',
      createdAt: new Date().toISOString(),
      inputs: calc.inputs ?? DEFAULT_INPUTS, // start from the calculator's current load
      rows: emptyRows(),
    }
    save(STORE_CASES, mine)
    location.hash = `#/check/${id}`
  })

  // Fill in pass/flag badges once the engine has run each case.
  void (async () => {
    const engine = await getEngine()
    for (const id of ids) {
      const badge = root.querySelector<HTMLElement>(`[data-badge="${id}"]`)
      if (!badge) continue
      try {
        const rows = await compareCase(cases[id], engine)
        setBadge(badge, rows)
      } catch {
        badge.textContent = 'error'
        badge.className = 'badge bad'
      }
    }
  })()
}

function setBadge(badge: HTMLElement, rows: ComparedRow[]): void {
  const filled = rows.filter((r) => r.elevationOk !== null || r.windageOk !== null).length
  const bad = flaggedRows(rows).length
  if (filled === 0) {
    badge.textContent = 'no data yet'
    badge.className = 'badge'
  } else {
    badge.textContent = bad ? `${bad} over ${TOLERANCE_MIL} mil` : `all within ${TOLERANCE_MIL} mil`
    badge.className = `badge ${bad ? 'bad' : 'good'}`
  }
}

// ---------- One comparison ----------

const cellValue = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

function renderEditor(root: HTMLElement, id: string): void {
  const readOnly = id.startsWith(BUILTIN_PREFIX)
  const c = allCases()[id]
  const dis = readOnly ? ' disabled' : ''
  const theirsInput = (name: string, n: number | null | undefined) =>
    `<input name="${name}" type="text" inputmode="text" autocomplete="off" value="${escapeHtml(cellValue(n))}"${dis} />`

  root.innerHTML = `
    <p><a href="#/check">&larr; All comparisons</a></p>
    <section class="card">
      ${readOnly ? '<p><small>This is a saved test case (read-only). Use Duplicate to edit a copy.</small></p>' : ''}
      <div class="group" style="border:0;padding:0">
        <label class="field"><span>Name</span><input name="caseName" type="text" value="${escapeHtml(c.name)}"${dis} /></label>
        <label class="field"><span>Compared with</span><select name="caseSource"${dis}>
          ${SOURCES.map((s) => `<option${s === c.source ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field"><span>App version</span><input name="caseVersion" type="text" value="${escapeHtml(c.appVersion ?? '')}" placeholder="optional"${dis} /></label>
        <label class="field"><span>Notes</span><input name="caseNotes" type="text" value="${escapeHtml(c.notes ?? '')}" placeholder="optional"${dis} /></label>
      </div>
      <p class="summary">Summary: <span class="badge" data-summary></span></p>
    </section>
    ${TIPS}
    <form class="shot-form" novalidate>${renderShotFields(toFormValues(c.inputs), readOnly)}</form>
    <ul class="errors" data-errors></ul>

    <section class="card">
      <h2>Elevation (mil)</h2>
      <table class="compare"><thead><tr><th>Yd</th><th>Theirs</th><th>Ours</th><th>Diff</th></tr></thead><tbody>
        ${c.rows
          .map(
            (r) => `<tr><td>${r.rangeYd}</td><td>${theirsInput(`elev-${r.rangeYd}`, r.elevationMil)}</td>
              <td data-ours-elev="${r.rangeYd}"></td><td data-diff-elev="${r.rangeYd}"></td></tr>`,
          )
          .join('')}
      </tbody></table>
    </section>

    <section class="card">
      <h2>Windage (mil)</h2>
      <small>Left = L or minus, right = R or plus.</small>
      <table class="compare"><thead><tr><th>Yd</th><th>Theirs</th><th>Ours</th><th>Diff</th></tr></thead><tbody>
        ${c.rows
          .map(
            (r) => `<tr><td>${r.rangeYd}</td><td>${theirsInput(`wind-${r.rangeYd}`, r.windageMil)}</td>
              <td data-ours-wind="${r.rangeYd}"></td><td data-diff-wind="${r.rangeYd}"></td></tr>`,
          )
          .join('')}
      </tbody></table>
    </section>

    <section class="card">
      <h2>Velocity &amp; time of flight <small>(optional, not flagged)</small></h2>
      <table class="compare"><thead><tr><th>Yd</th><th>Their fps</th><th>Ours</th><th>Their s</th><th>Ours</th></tr></thead><tbody>
        ${c.rows
          .map(
            (r) => `<tr><td>${r.rangeYd}</td><td>${theirsInput(`vel-${r.rangeYd}`, r.velocityFps)}</td><td data-ours-vel="${r.rangeYd}"></td>
              <td>${theirsInput(`tof-${r.rangeYd}`, r.timeOfFlightS)}</td><td data-ours-tof="${r.rangeYd}"></td></tr>`,
          )
          .join('')}
      </tbody></table>
    </section>

    <section class="card actions">
      <button class="primary" data-action="export">Export as test case</button>
      <button data-action="copy">Copy test case</button>
      <button data-action="duplicate">Duplicate</button>
      ${readOnly ? '' : '<button class="danger" data-action="delete">Delete</button>'}
    </section>`

  const form = root.querySelector<HTMLFormElement>('form')!
  const errorsBox = root.querySelector<HTMLUListElement>('[data-errors]')!
  const field = (name: string) => root.querySelector<HTMLInputElement>(`[name="${name}"]`)!
  const cell = (attr: string, yd: number) => root.querySelector<HTMLElement>(`[${attr}="${yd}"]`)!
  let current: ReferenceCase = c
  let latest = 0

  /** Reads every box into a ReferenceCase. Returns problems found. */
  function readCase(): { next?: ReferenceCase; errors: string[] } {
    const values = readFormValues(form)
    updateVisibility(form, values)
    const { inputs, errors } = parseFormValues(values)
    const rows: ReferenceRow[] = RANGES_YD.map((rangeYd) => {
      const elev = parseMil(field(`elev-${rangeYd}`).value)
      const wind = parseMil(field(`wind-${rangeYd}`).value)
      const vel = field(`vel-${rangeYd}`).value.trim()
      const tof = field(`tof-${rangeYd}`).value.trim()
      if (Number.isNaN(elev)) errors.push(`Elevation at ${rangeYd} yd isn't a number.`)
      if (Number.isNaN(wind)) errors.push(`Windage at ${rangeYd} yd isn't a number.`)
      const num = (t: string) => (t === '' || Number.isNaN(Number(t)) ? null : Number(t))
      return {
        rangeYd,
        elevationMil: Number.isNaN(elev) ? null : elev,
        windageMil: Number.isNaN(wind) ? null : wind,
        velocityFps: num(vel),
        timeOfFlightS: num(tof),
      }
    })
    const next: ReferenceCase = {
      name: field('caseName').value.trim() || 'Untitled',
      source: root.querySelector<HTMLSelectElement>('[name="caseSource"]')!.value as ReferenceCase['source'],
      appVersion: field('caseVersion').value.trim() || undefined,
      notes: field('caseNotes').value.trim() || undefined,
      createdAt: c.createdAt,
      inputs: inputs ?? current.inputs,
      rows,
    }
    return { next: inputs ? next : undefined, errors }
  }

  async function refresh() {
    const run = ++latest
    const { next, errors } = readCase()
    errorsBox.innerHTML = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')
    if (!next) return
    current = next
    if (!readOnly) {
      const mine = loadMine()
      mine[id] = current
      save(STORE_CASES, mine)
    }
    try {
      const rows = await compareCase(current, await getEngine())
      if (run !== latest) return
      showResults(rows)
    } catch (e) {
      if (run !== latest) return
      errorsBox.innerHTML = `<li>${escapeHtml((e as Error).message)}</li>`
    }
  }

  function showResults(rows: ComparedRow[]) {
    for (const r of rows) {
      cell('data-ours-elev', r.rangeYd).textContent = r.ours.elevationMil.toFixed(2)
      cell('data-ours-wind', r.rangeYd).textContent = r.ours.windageMil.toFixed(2)
      cell('data-ours-vel', r.rangeYd).textContent = Math.round(r.ours.velocityFps).toString()
      cell('data-ours-tof', r.rangeYd).textContent = r.ours.timeOfFlightS.toFixed(3)
      showDiff(cell('data-diff-elev', r.rangeYd), r.elevationDiff, r.elevationOk)
      showDiff(cell('data-diff-wind', r.rangeYd), r.windageDiff, r.windageOk)
    }
    setBadge(root.querySelector<HTMLElement>('[data-summary]')!, rows)
  }

  function showDiff(td: HTMLElement, diff: number | null, ok: boolean | null) {
    td.textContent = diff === null ? '' : `${signed(diff)}${ok ? '' : ' ⚠'}`
    td.className = ok === null ? '' : ok ? 'flag-good' : 'flag-bad'
  }

  root.addEventListener('input', refresh)
  root.addEventListener('change', refresh)

  root.querySelector('[data-action="export"]')!.addEventListener('click', () => {
    const blob = new Blob([caseJson(current)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${slug(current.source)}-${slug(current.name)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  root.querySelector<HTMLButtonElement>('[data-action="copy"]')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement
    try {
      await navigator.clipboard.writeText(caseJson(current))
      btn.textContent = 'Copied ✓'
    } catch {
      btn.textContent = 'Copy failed — use Export'
    }
  })
  root.querySelector('[data-action="duplicate"]')!.addEventListener('click', () => {
    const newId = Date.now().toString(36)
    const mine = loadMine()
    mine[newId] = { ...current, name: `${current.name} (copy)`, createdAt: new Date().toISOString() }
    save(STORE_CASES, mine)
    location.hash = `#/check/${newId}`
  })
  root.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (!confirm(`Delete "${current.name}"? This can't be undone.`)) return
    const mine = loadMine()
    delete mine[id]
    save(STORE_CASES, mine)
    location.hash = '#/check'
  })

  void refresh()
}

const caseJson = (c: ReferenceCase) => JSON.stringify(c, null, 2) + '\n'
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'case'
