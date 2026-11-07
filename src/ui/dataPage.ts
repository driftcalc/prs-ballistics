// Data page: export everything / rifles, and import a file back.
import {
  describeImport,
  ImportError,
  mergeImport,
  parseBackupJson,
  parseRiflesCsv,
  replaceImport,
  toBackupJson,
  toRiflesCsv,
  type ImportBundle,
} from '../data/backup.ts'
import { getData, replaceData, RESCUE_PREFIX, updateData } from '../data/store.ts'
import { keysStartingWith, loadRaw, remove } from './storage.ts'
import { downloadFile } from './download.ts'
import { escapeHtml } from './format.ts'
import { applyNightMode } from './nightMode.ts'
import { backupOverdue, daysSinceBackup } from './safety.ts'

const today = () => new Date().toISOString().slice(0, 10)

function lastBackupText(): string {
  const d = getData()
  const at = d.settings.lastBackupAt
  const base = at ? `Last full backup: ${new Date(at).toLocaleString()}.` : 'No full backup exported yet.'
  if (!backupOverdue(d)) return base
  const days = daysSinceBackup(d)
  return `${base} ⚠ ${days === undefined ? 'Export one now' : `That was ${days} days ago — export a fresh one`} so a lost or reset phone doesn't take your data with it.`
}

/** Copies of saved data the app couldn't read (kept instead of being thrown away). */
function rescueSection(): string {
  const keys = keysStartingWith(RESCUE_PREFIX)
  if (!keys.length) return ''
  return `
    <section class="card stack banner error">
      <h2>Damaged data kept for rescue</h2>
      <p>This phone had saved data the app couldn't read, so a copy was kept instead of being thrown away.
        Download it and send it to whoever helps you with the app; it may be repairable.</p>
      ${keys
        .map((k) => {
          const when = new Date(Number(k.slice(RESCUE_PREFIX.length)))
          return `<div class="actions">
            <button class="big-button" data-rescue-download="${escapeHtml(k)}">Download copy from ${escapeHtml(when.toLocaleString())}</button>
            <button class="danger" data-rescue-delete="${escapeHtml(k)}">Delete copy</button></div>`
        })
        .join('')}
    </section>`
}

export function renderDataPage(root: HTMLElement): void {
  const d = getData()
  root.innerHTML = `
    <section class="card">
      <h2>Your data</h2>
      <p>Everything is stored only on this phone: ${d.profiles.length} rifle${d.profiles.length === 1 ? '' : 's'},
        ${d.log.length} logged shot${d.log.length === 1 ? '' : 's'},
        ${Object.keys(d.comparisons).length} comparison${Object.keys(d.comparisons).length === 1 ? '' : 's'}, weather and settings.
        Export a backup after changes — clearing browser data or removing the app deletes it.</p>
      <p class="${backupOverdue(d) ? 'backup-due' : ''}" data-last-backup>${escapeHtml(lastBackupText())}</p>
    </section>

    ${rescueSection()}

    <section class="card stack">
      <h2>Export</h2>
      <button class="primary big-button" data-action="export-json">Export everything (JSON)</button>
      <small>Full backup: rifles, comparisons, weather, settings. Use this to restore or move to a new phone.</small>
      <button class="big-button" data-action="export-csv">Export rifles (CSV)</button>
      <small>One row per rifle. Opens in Excel or Google Sheets.</small>
    </section>

    <section class="card stack">
      <h2>Import</h2>
      <label class="button big-button file-button">Choose a file…
        <input type="file" accept=".json,.csv,application/json,text/csv" hidden data-file />
      </label>
      <small>A JSON backup or a rifles CSV from this app (or a spreadsheet with the same columns).</small>
      <div data-import-result></div>
    </section>`

  root.querySelector('[data-action="export-json"]')!.addEventListener('click', () => {
    downloadFile(`spin-drift-backup-${today()}.json`, toBackupJson(getData()), 'application/json')
    updateData((data) => void (data.settings.lastBackupAt = new Date().toISOString()))
    const note = root.querySelector('[data-last-backup]')!
    note.textContent = lastBackupText()
    note.classList.remove('backup-due')
    document.querySelector('.tabs a[data-page="data"]')?.removeAttribute('data-due')
  })

  root.querySelectorAll<HTMLButtonElement>('[data-rescue-download]').forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.rescueDownload!
      downloadFile(`spin-drift-damaged-data-${key.slice(RESCUE_PREFIX.length)}.txt`, loadRaw(key) ?? '', 'text/plain')
    }),
  )
  root.querySelectorAll<HTMLButtonElement>('[data-rescue-delete]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm("Delete this damaged copy? Download it first if you might want it — this can't be undone.")) return
      remove(b.dataset.rescueDelete!)
      renderDataPage(root)
    }),
  )

  root.querySelector('[data-action="export-csv"]')!.addEventListener('click', () => {
    downloadFile(`spin-drift-rifles-${today()}.csv`, toRiflesCsv(getData().profiles), 'text/csv')
  })

  const resultBox = root.querySelector<HTMLElement>('[data-import-result]')!
  const fileInput = root.querySelector<HTMLInputElement>('[data-file]')!

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = '' // allow picking the same file again
    if (!file) return
    let bundle: ImportBundle
    try {
      const text = await file.text()
      const isJson = file.name.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{')
      bundle = isJson ? parseBackupJson(text) : parseRiflesCsv(text)
    } catch (e) {
      const msg = e instanceof ImportError ? e.message : "Couldn't read this file."
      resultBox.innerHTML = `<ul class="errors"><li>${escapeHtml(msg)}</li></ul>`
      return
    }
    showPreview(file.name, bundle)
  })

  function showPreview(fileName: string, bundle: ImportBundle) {
    const replaceLabel = bundle.kind === 'json' ? 'Replace everything' : 'Replace all rifles'
    resultBox.innerHTML = `
      <div class="import-preview">
        <p><strong>${escapeHtml(fileName)}</strong> contains ${escapeHtml(describeImport(bundle))}.</p>
        ${bundle.warnings.length ? `<ul class="errors">${bundle.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : ''}
        <div class="actions">
          <button class="primary big-button" data-import="merge">Add to my data</button>
          <button class="danger big-button" data-import="replace">${replaceLabel}</button>
          <button class="big-button" data-import="cancel">Cancel</button>
        </div>
        <small>Add keeps everything you have and updates rifles with the same name.</small>
      </div>`

    resultBox.querySelector('[data-import="merge"]')!.addEventListener('click', () => {
      replaceData(mergeImport(getData(), bundle))
      done(`Added ${describeImport(bundle)}.`)
    })
    resultBox.querySelector('[data-import="replace"]')!.addEventListener('click', () => {
      const what = bundle.kind === 'json' ? 'ALL your current rifles, comparisons, weather and settings' : 'ALL your current rifles'
      if (!confirm(`This deletes ${what} on this phone and uses the file instead. Continue?`)) return
      replaceData(replaceImport(getData(), bundle))
      applyNightMode()
      done(`Replaced with ${describeImport(bundle)}.`)
    })
    resultBox.querySelector('[data-import="cancel"]')!.addEventListener('click', () => {
      resultBox.innerHTML = ''
    })
  }

  function done(message: string) {
    renderDataPage(root)
    root.querySelector('[data-import-result]')!.innerHTML = `<p class="ok-note">✓ ${escapeHtml(message)}</p>`
  }
}
