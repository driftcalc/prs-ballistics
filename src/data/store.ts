// Everything the app saves, kept together in one bundle on this device.
// Version number lets future updates convert old saved data safely.
import type { ReferenceCase } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { parseFormValues, type FormValues } from '../ui/shotForm.ts'
import { load, save } from '../ui/storage.ts'
import type { DopeEntry } from './log.ts'
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
export const DATA_VERSION = 3
const STORE_KEY = 'prs.data'

export interface ShootState extends WindInputs {
  /** Last-used rifle. */
  profileId?: string
  rangeYd: number
  /** How far one tap of +/- moves the range. */
  rangeStepYd: number
}

export interface Settings {
  angleUnit: 'mil' | 'moa'
  night: boolean
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
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    profiles: [],
    conditions: { ...DEFAULT_CONDITIONS },
    shoot: { rangeYd: 600, rangeStepYd: 25, windSpeedMph: DEFAULT_INPUTS.windSpeedMph, windClock: DEFAULT_INPUTS.windClock },
    settings: { angleUnit: 'mil', night: false },
    comparisons: {},
    log: [],
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
    settings: { ...base.settings, ...saved.settings },
    conditions: { ...base.conditions, ...saved.conditions },
    log: Array.isArray(saved.log) ? saved.log : [], // added in version 2
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

export function getData(): AppData {
  if (!cache) {
    const saved = load<AppData | null>(STORE_KEY, null)
    cache =
      saved && typeof saved.version === 'number'
        ? upgradeSaved(saved)
        : migrateLegacy(
            load<FormValues | undefined>('calc.inputs', undefined),
            load<string | undefined>('calc.targetYd', undefined),
            load<Record<string, ReferenceCase> | undefined>('accuracy.cases', undefined),
          )
    save(STORE_KEY, cache)
  }
  return cache
}

/** Changes the data and saves it straight away. */
export function updateData(change: (d: AppData) => void): AppData {
  const d = getData()
  change(d)
  save(STORE_KEY, d)
  return d
}

/** Swaps in a whole new bundle (used by Import). */
export function replaceData(next: AppData): void {
  cache = next
  save(STORE_KEY, next)
}

/** The rifle the Shoot screen should open on (last used, else the first). */
export function currentProfile(d: AppData = getData()): RifleProfile | undefined {
  return d.profiles.find((p) => p.id === d.shoot.profileId) ?? d.profiles[0]
}
