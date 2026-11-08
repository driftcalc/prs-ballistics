// Export and import of the user's data, so nothing is ever trapped in the app.
// JSON = full backup of everything. CSV = rifles only, for spreadsheets.
import { validateCase, type ReferenceCase } from '../accuracy/compare.ts'
import { parseFormValues, type FormValues } from '../ui/shotForm.ts'
import { logEntryProblem, type DopeEntry } from './log.ts'
import { matchProblem, type Match } from './match.ts'
import { newId, RIFLE_KEYS, rifleOf, type RifleData, type RifleProfile } from './profiles.ts'
import { DATA_VERSION, emptyData, normalizeSettings, type AppData } from './store.ts'

const APP_ID = 'prs-ballistics'

/** What an imported file contained, ready to add or replace. */
export interface ImportBundle {
  kind: 'json' | 'csv'
  profiles: RifleProfile[]
  comparisons: Record<string, ReferenceCase>
  log: DopeEntry[]
  matches: Match[]
  /** Only in a full JSON backup. */
  full?: AppData
  /** Rows or items that were skipped, in plain words. */
  warnings: string[]
}

export class ImportError extends Error {}

// ---------- JSON ----------

export function toBackupJson(data: AppData, now = new Date()): string {
  return JSON.stringify({ app: APP_ID, format: DATA_VERSION, exportedAt: now.toISOString(), data }, null, 2) + '\n'
}

/** Checks rifle numbers with the same rules as the input boxes. */
function checkRifle(rifle: Partial<RifleData> | undefined): { rifle?: RifleData; errors: string[] } {
  const values: FormValues = {}
  for (const k of RIFLE_KEYS) {
    const v = rifle?.[k]
    values[k] = v === undefined || v === null ? '' : String(v)
  }
  const { inputs, errors } = parseFormValues(values, ['rifle'])
  return { rifle: inputs ? rifleOf(inputs) : undefined, errors }
}

export function parseBackupJson(text: string): ImportBundle {
  let parsed: { app?: string; format?: number; data?: Partial<AppData> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError("This file isn't valid JSON.")
  }
  if (parsed?.app !== APP_ID || !parsed.data) {
    throw new ImportError("This file isn't a Spin Drift backup.")
  }
  if (typeof parsed.format !== 'number' || parsed.format > DATA_VERSION) {
    throw new ImportError('This backup is from a newer version of the app. Update the app first.')
  }

  const src = parsed.data
  const warnings: string[] = []
  const profiles: RifleProfile[] = []
  for (const p of Array.isArray(src.profiles) ? src.profiles : []) {
    const { rifle, errors } = checkRifle(p?.rifle)
    const name = typeof p?.name === 'string' && p.name.trim() ? p.name.trim() : 'Unnamed rifle'
    if (!rifle) {
      warnings.push(`Skipped rifle "${name}": ${errors.join(' ')}`)
      continue
    }
    profiles.push({
      id: typeof p.id === 'string' && p.id ? p.id : newId(),
      name,
      notes: typeof p.notes === 'string' ? p.notes : undefined,
      rifle,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
      // Library link (data version 3); kept only if it looks right.
      ...(p.factory && typeof p.factory.loadId === 'string'
        ? {
            factory: {
              loadId: p.factory.loadId,
              barrelIn: typeof p.factory.barrelIn === 'number' ? p.factory.barrelIn : undefined,
              mvEstimated: p.factory.mvEstimated === true,
            },
          }
        : {}),
    })
  }

  const comparisons: Record<string, ReferenceCase> = {}
  for (const [id, c] of Object.entries(src.comparisons ?? {})) {
    try {
      comparisons[id] = validateCase(c, 'Comparison')
    } catch (e) {
      warnings.push(`Skipped a comparison: ${(e as Error).message}`)
    }
  }

  // Dope log (added in data version 2; older backups simply have none).
  const log: DopeEntry[] = []
  for (const e of Array.isArray(src.log) ? src.log : []) {
    const problem = logEntryProblem(e)
    if (problem) warnings.push(`Skipped a log entry: ${problem}.`)
    else log.push(e)
  }

  // Matches (added in data version 6; older backups simply have none).
  const matches: Match[] = []
  for (const m of Array.isArray(src.matches) ? src.matches : []) {
    const problem = matchProblem(m)
    if (problem) warnings.push(`Skipped a match: ${problem}.`)
    else matches.push(m)
  }

  const base = emptyData()
  const full: AppData = {
    ...base,
    profiles,
    comparisons,
    log,
    matches,
    conditions: { ...base.conditions, ...src.conditions },
    shoot: { ...base.shoot, ...src.shoot },
    settings: normalizeSettings(src.settings),
  }
  return { kind: 'json', profiles, comparisons, log, matches, full, warnings }
}

// ---------- CSV (rifles only) ----------

/** Column headings, in order. Written with units so the sheet is self-explanatory. */
const CSV_COLUMNS: [heading: string, key: 'name' | 'notes' | (typeof RIFLE_KEYS)[number]][] = [
  ['Name', 'name'],
  ['Notes', 'notes'],
  ['Muzzle velocity (fps)', 'muzzleVelocityFps'],
  ['BC', 'bc'],
  ['BC type (G1/G7)', 'dragModel'],
  ['Bullet weight (gr)', 'bulletWeightGr'],
  ['Bullet diameter (in)', 'bulletDiameterIn'],
  ['Bullet length (in)', 'bulletLengthIn'],
  ['Sight height (in)', 'sightHeightIn'],
  ['Zero range (yd)', 'zeroRangeYd'],
  ['Twist (in per turn)', 'twistIn'],
  ['Twist direction (right/left)', 'twistDirection'],
]

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toRiflesCsv(profiles: RifleProfile[]): string {
  const rows = [CSV_COLUMNS.map(([h]) => h)]
  for (const p of profiles) {
    rows.push(CSV_COLUMNS.map(([, key]) => (key === 'name' ? p.name : key === 'notes' ? p.notes : p.rifle[key]) as string))
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Splits CSV text into rows of cells. Handles quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '') // Excel adds an invisible marker at the start
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const normalise = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

export function parseRiflesCsv(text: string): ImportBundle {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new ImportError('This CSV file is empty.')
  const header = rows[0].map(normalise)
  const index = new Map(CSV_COLUMNS.map(([h, key]) => [key, header.indexOf(normalise(h))]))
  if (index.get('name')! < 0 || index.get('muzzleVelocityFps')! < 0) {
    throw new ImportError('This CSV doesn\'t look like a rifles file (needs "Name" and "Muzzle velocity (fps)" columns).')
  }

  const warnings: string[] = []
  const profiles: RifleProfile[] = []
  rows.slice(1).forEach((cells, i) => {
    const get = (key: (typeof CSV_COLUMNS)[number][1]) => {
      const at = index.get(key)!
      return at < 0 ? '' : (cells[at] ?? '').trim()
    }
    const name = get('name') || `Rifle ${i + 1}`
    const values: FormValues = {}
    for (const k of RIFLE_KEYS) values[k] = get(k)
    // Friendly defaults for columns people often leave blank.
    values.dragModel = (values.dragModel || 'G7').toUpperCase()
    values.twistDirection = (values.twistDirection || 'right').toLowerCase()
    const { inputs, errors } = parseFormValues(values, ['rifle'])
    if (!inputs || !['G1', 'G7'].includes(values.dragModel) || !['right', 'left'].includes(values.twistDirection)) {
      const extra = !['G1', 'G7'].includes(values.dragModel) ? ['BC type must be G1 or G7.'] : []
      warnings.push(`Skipped row ${i + 2} ("${name}"): ${[...errors, ...extra].join(' ') || 'invalid values.'}`)
      return
    }
    profiles.push({ id: newId(), name, notes: get('notes') || undefined, rifle: rifleOf(inputs), updatedAt: new Date().toISOString() })
  })
  if (profiles.length === 0 && warnings.length === 0) throw new ImportError('No rifles found in this CSV file.')
  return { kind: 'csv', profiles, comparisons: {}, log: [], matches: [], warnings }
}

// ---------- Applying an import ----------

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** "Add to my data": keeps everything, updates rifles with the same name, adds the rest. */
export function mergeImport(current: AppData, incoming: ImportBundle): AppData {
  const next: AppData = structuredClone(current)
  for (const p of incoming.profiles) {
    const match = next.profiles.find((x) => sameName(x.name, p.name))
    if (match) Object.assign(match, { rifle: p.rifle, notes: p.notes, updatedAt: p.updatedAt })
    else next.profiles.push({ ...p, id: next.profiles.some((x) => x.id === p.id) ? newId() : p.id })
  }
  Object.assign(next.comparisons, incoming.comparisons)
  // Log entries are added unless the same entry is already here.
  const have = new Set(next.log.map((e) => e.id))
  next.log.push(...incoming.log.filter((e) => !have.has(e.id)))
  // Matches likewise.
  const haveMatch = new Set(next.matches.map((m) => m.id))
  next.matches.push(...incoming.matches.filter((m) => !haveMatch.has(m.id)))
  return next
}

/**
 * "Replace": a JSON backup replaces everything; a rifles CSV replaces the
 * rifles only (comparisons, weather and settings are kept).
 */
export function replaceImport(current: AppData, incoming: ImportBundle): AppData {
  if (incoming.full) return structuredClone(incoming.full)
  const next: AppData = structuredClone(current)
  next.profiles = incoming.profiles
  next.shoot.profileId = incoming.profiles[0]?.id
  return next
}

/** e.g. "3 rifles, 2 comparisons, weather and settings" */
export function describeImport(b: ImportBundle): string {
  const parts = [`${b.profiles.length} rifle${b.profiles.length === 1 ? '' : 's'}`]
  if (b.kind === 'json') {
    const n = Object.keys(b.comparisons).length
    const l = b.log.length
    const m = b.matches.length
    parts.push(`${n} comparison${n === 1 ? '' : 's'}`, `${l} logged shot${l === 1 ? '' : 's'}`, `${m} match${m === 1 ? '' : 'es'}`, 'weather and settings')
  }
  return parts.join(', ')
}
