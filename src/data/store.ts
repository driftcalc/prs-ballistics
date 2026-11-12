// Everything the app saves, kept together in one bundle on this device.
// Version number lets future updates convert old saved data safely.
import type { ReferenceCase } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { parseFormValues, type FormValues } from '../ui/shotForm.ts'
import { load, loadRaw, save, saveRaw } from '../ui/storage.ts'
import type { DopeEntry } from './log.ts'
import type { Match } from './match.ts'
import {
  conditionsOf,
  DEFAULT_CONDITIONS,
  newId,
  rifleOf,
  type Conditions,
  type RifleProfile,
  type WindInputs,
} from './profiles.ts'

// 1 = v0.2 (rifles, conditions, shoot, settings, comparisons). 2 = adds the dope log.
// 3 = rifles may have `factory` (filled from the ammo library; optional, nothing to convert).
// 4 = settings.night (on/off) becomes settings.theme; adds glove and leftHanded.
// 5 = adds settings.holdMode (Dial or Hold labels on Shoot; default dial).
// 6 = adds matches (stage cards) and settings.cardWindsMph (default 5 and 10 mph).
// 7 = adds settings.rangeCard (range card step and max range; default 50 yd to 1000 yd).
// 8 = rifles may have truingHistory (changes the truing assistant applied, for Revert; optional, nothing to convert).
export const DATA_VERSION = 8
const STORE_KEY = 'prs.data'

export interface ShootState extends WindInputs {
  /** Last-used rifle. */
  profileId?: string
  rangeYd: number
  /** How far one tap of +/- moves the range. */
  rangeStepYd: number
}

export const THEMES = ['auto', 'sun', 'dark', 'night'] as const
/** auto = follow the phone's light/dark setting (Sun or Dark). */
export type ThemeSetting = (typeof THEMES)[number]

export interface Settings {
  angleUnit: 'mil' | 'moa'
  theme: ThemeSetting
  /** Primary controls at least 96px, for gloves. */
  glove: boolean
  /** Mirror bottom control rows for the left thumb. */
  leftHanded: boolean
  /** Shoot labels: 'dial' = turret values (DIAL UP 4.6), 'hold' = reticle holds (HOLD 4.6 OVER). Same numbers. */
  holdMode: 'dial' | 'hold'
  /** The two wind speeds stage cards show holds for. */
  cardWindsMph: [number, number]
  /** Range card table: distance between rows and the farthest row. */
  rangeCard: { stepYd: 25 | 50; maxYd: number }
  /** When the last full backup was exported, to remind the user. */
  lastBackupAt?: string
  /** User closed the "add to Home Screen" tip. */
  installTipDismissed?: boolean
}

export interface AppData {
  version: typeof DATA_VERSION
  profiles: RifleProfile[]
  conditions: Conditions
  shoot: ShootState
  settings: Settings
  /** Check accuracy comparisons, keyed by id. */
  comparisons: Record<string, ReferenceCase>
  /** Dope logbook, oldest first. */
  log: DopeEntry[]
  /** Matches with their stage cards, newest first. */
  matches: Match[]
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    profiles: [],
    conditions: { ...DEFAULT_CONDITIONS },
    shoot: { rangeYd: 600, rangeStepYd: 25, windSpeedMph: DEFAULT_INPUTS.windSpeedMph, windClock: DEFAULT_INPUTS.windClock },
    settings: { angleUnit: 'mil', theme: 'auto', glove: false, leftHanded: false, holdMode: 'dial', cardWindsMph: [5, 10], rangeCard: { stepYd: 50, maxYd: 1000 } },
    comparisons: {},
    log: [],
    matches: [],
  }
}

/** Two whole wind speeds 1–60 mph; anything else falls back to 5 and 10. */
function cardWinds(v: unknown): [number, number] {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 60
  return Array.isArray(v) && v.length === 2 && ok(v[0]) && ok(v[1]) ? [v[0], v[1]] : [5, 10]
}

export const RANGE_CARD_MIN_YD = 200
export const RANGE_CARD_MAX_YD = 3000

/** Step 25 or 50 yd; max a whole 50 yd from 200 to 3000. Anything else: 50 yd to 1000 yd. */
function rangeCardSettings(v: unknown): Settings['rangeCard'] {
  const r = (v ?? {}) as Partial<Settings['rangeCard']>
  const stepYd = r.stepYd === 25 ? 25 : 50
  const ok = typeof r.maxYd === 'number' && r.maxYd >= RANGE_CARD_MIN_YD && r.maxYd <= RANGE_CARD_MAX_YD && r.maxYd % 50 === 0
  return { stepYd, maxYd: ok ? r.maxYd! : 1000 }
}

/**
 * Settings from any version (or a backup file) with defaults filled in.
 * Before version 4 there was only night on/off: on -> Night theme, off -> Auto.
 */
export function normalizeSettings(raw: (Partial<Settings> & { night?: unknown }) | undefined): Settings {
  const { night, ...rest } = raw ?? {}
  const base = emptyData().settings
  const theme = THEMES.includes(rest.theme as ThemeSetting) ? (rest.theme as ThemeSetting) : night === true ? 'night' : 'auto'
  return {
    ...base,
    ...rest,
    angleUnit: rest.angleUnit === 'moa' ? 'moa' : 'mil',
    theme,
    glove: rest.glove === true,
    leftHanded: rest.leftHanded === true,
    holdMode: rest.holdMode === 'hold' ? 'hold' : 'dial',
    cardWindsMph: cardWinds(rest.cardWindsMph),
    rangeCard: rangeCardSettings(rest.rangeCard),
  }
}

/**
 * Brings a saved bundle from any earlier version up to date. Missing pieces
 * get defaults; nothing that was saved is dropped.
 */
export function upgradeSaved(saved: { version?: number } & Partial<AppData>): AppData {
  const base = emptyData()
  return {
    ...base,
    ...saved,
    shoot: { ...base.shoot, ...saved.shoot },
    settings: normalizeSettings(saved.settings),
    conditions: { ...base.conditions, ...saved.conditions },
    log: Array.isArray(saved.log) ? saved.log : [], // added in version 2
    matches: Array.isArray(saved.matches) ? saved.matches : [], // added in version 6
    version: DATA_VERSION,
  }
}

/**
 * Builds the bundle from what version 0.1 saved (Calculator inputs and
 * comparisons), so nobody loses data when they update.
 */
export function migrateLegacy(calcValues?: FormValues, targetYd?: string, cases?: Record<string, ReferenceCase>): AppData {
  const data = emptyData()
  const parsed = calcValues ? parseFormValues(calcValues).inputs : undefined
  if (parsed) {
    const id = newId()
    data.profiles.push({ id, name: 'My rifle', rifle: rifleOf(parsed), updatedAt: new Date().toISOString() })
    data.conditions = conditionsOf(parsed)
    data.shoot = { ...data.shoot, profileId: id, windSpeedMph: parsed.windSpeedMph, windClock: parsed.windClock }
  }
  const range = Number(targetYd)
  if (range > 0) data.shoot.rangeYd = range
  if (cases) data.comparisons = { ...cases }
  return data
}

let cache: AppData | undefined

/** Event fired on `window` when saving starts failing or works again (detail: { ok }). */
export const SAVE_STATUS_EVENT = 'spin-drift:save-status'
let lastSaveOk = true

/** Writes the bundle and tells the app if saving failed (e.g. storage full, private browsing). */
function persist(d: AppData): void {
  const ok = save(STORE_KEY, d)
  if (ok !== lastSaveOk) {
    lastSaveOk = ok
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVE_STATUS_EVENT, { detail: { ok } }))
  }
}

/** Saved copies of data the app couldn't read, kept so nothing is lost. */
export const RESCUE_PREFIX = `${STORE_KEY}.unreadable-`

/**
 * If saved data exists but can't be read (damaged, or written by something
 * else), keep an exact copy under a separate name BEFORE starting fresh, so it
 * can be downloaded from the Data tab and rescued.
 */
function keepUnreadableCopy(): void {
  const raw = loadRaw(STORE_KEY)
  if (raw === null) return
  let readable = false
  try {
    const parsed = JSON.parse(raw)
    readable = !!parsed && typeof parsed.version === 'number'
  } catch {
    readable = false
  }
  if (!readable) saveRaw(`${RESCUE_PREFIX}${Date.now()}`, raw)
}

export function getData(): AppData {
  if (!cache) {
    const saved = load<AppData | null>(STORE_KEY, null)
    if (!(saved && typeof saved.version === 'number')) keepUnreadableCopy()
    cache =
      saved && typeof saved.version === 'number'
        ? upgradeSaved(saved)
        : migrateLegacy(
            load<FormValues | undefined>('calc.inputs', undefined),
            load<string | undefined>('calc.targetYd', undefined),
            load<Record<string, ReferenceCase> | undefined>('accuracy.cases', undefined),
          )
    persist(cache)
  }
  return cache
}

/**
 * The newest saved bundle. Another copy of the app (a second tab) may have
 * saved since we last read, so read storage again rather than trusting memory.
 * If saving has been failing, storage is OLDER than memory, so keep memory.
 */
function latest(): AppData {
  if (!cache || !lastSaveOk) return getData()
  const saved = load<AppData | null>(STORE_KEY, null)
  if (saved && typeof saved.version === 'number') cache = upgradeSaved(saved)
  return cache
}

/** Changes the data and saves it straight away. */
export function updateData(change: (d: AppData) => void): AppData {
  const d = latest()
  change(d)
  persist(d)
  return d
}

// Another tab saved: forget our copy so the next read picks up its changes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY && lastSaveOk) cache = undefined
  })
}

/** Swaps in a whole new bundle (used by Import). */
export function replaceData(next: AppData): void {
  cache = next
  persist(next)
}

/** The rifle the Shoot screen should open on (last used, else the first). */
export function currentProfile(d: AppData = getData()): RifleProfile | undefined {
  return d.profiles.find((p) => p.id === d.shoot.profileId) ?? d.profiles[0]
}
