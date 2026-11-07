// Rifle profiles, shared conditions and wind, and how they combine into the
// full set of shot inputs. All values in the US units the shooter types.
import { DEFAULT_INPUTS, type UsShotInputs } from '../shotInputs.ts'

export const RIFLE_KEYS = [
  'muzzleVelocityFps',
  'bc',
  'dragModel',
  'bulletWeightGr',
  'bulletDiameterIn',
  'bulletLengthIn',
  'sightHeightIn',
  'zeroRangeYd',
  'twistIn',
  'twistDirection',
] as const satisfies readonly (keyof UsShotInputs)[]

export const CONDITION_KEYS = [
  'temperatureF',
  'atmosphereMode',
  'stationPressureInHg',
  'altitudeFt',
  'humidityPct',
] as const satisfies readonly (keyof UsShotInputs)[]

export const WIND_KEYS = ['windSpeedMph', 'windClock'] as const satisfies readonly (keyof UsShotInputs)[]

/** Rifle + bullet + load data. */
export type RifleData = Pick<UsShotInputs, (typeof RIFLE_KEYS)[number]>
/** Weather, shared by every rifle. */
export type Conditions = Pick<UsShotInputs, (typeof CONDITION_KEYS)[number]>
export type WindInputs = Pick<UsShotInputs, (typeof WIND_KEYS)[number]>

export interface RifleProfile {
  id: string
  name: string
  notes?: string
  rifle: RifleData
  updatedAt: string
}

function pick<K extends keyof UsShotInputs>(us: UsShotInputs, keys: readonly K[]): Pick<UsShotInputs, K> {
  const out = {} as Pick<UsShotInputs, K>
  for (const k of keys) out[k] = us[k]
  return out
}

export const rifleOf = (us: UsShotInputs): RifleData => pick(us, RIFLE_KEYS)
export const conditionsOf = (us: UsShotInputs): Conditions => pick(us, CONDITION_KEYS)
export const windOf = (us: UsShotInputs): WindInputs => pick(us, WIND_KEYS)

export const DEFAULT_RIFLE = rifleOf(DEFAULT_INPUTS)
export const DEFAULT_CONDITIONS = conditionsOf(DEFAULT_INPUTS)

/** Everything the engine needs for one shot. */
export function combine(rifle: RifleData, conditions: Conditions, wind: WindInputs): UsShotInputs {
  return { ...DEFAULT_INPUTS, ...rifle, ...conditions, ...wind }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Short one-line description, e.g. "2700 fps · G7 0.300 · 140 gr · 100 yd zero". */
export function rifleSummary(r: RifleData): string {
  return `${r.muzzleVelocityFps} fps · ${r.dragModel} ${r.bc.toFixed(3)} · ${r.bulletWeightGr} gr · ${r.zeroRangeYd} yd zero`
}
