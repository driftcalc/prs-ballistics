// The inputs exactly as the shooter types them (US units), and the single
// place they are converted to the SI ShotInput the ballistics engine uses.
import type { DragModelName, ShotInput } from './ballistics/index.ts'
import * as u from './units/index.ts'

export interface UsShotInputs {
  muzzleVelocityFps: number
  bc: number
  dragModel: DragModelName
  bulletWeightGr: number
  /** Optional; with length and twist enables spin drift. */
  bulletDiameterIn?: number
  /** Optional; leave out for no spin drift. */
  bulletLengthIn?: number
  sightHeightIn: number
  zeroRangeYd: number
  /** Inches per turn (the "8" in 1:8). Optional. */
  twistIn?: number
  twistDirection: 'right' | 'left'
  temperatureF: number
  atmosphereMode: 'pressure' | 'altitude'
  /** Station pressure (not sea-level corrected), used when atmosphereMode = 'pressure'. */
  stationPressureInHg?: number
  /** Used when atmosphereMode = 'altitude'. */
  altitudeFt?: number
  humidityPct: number
  windSpeedMph: number
  /** Clock position the wind comes from: 12 = head wind, 3 = from the right. */
  windClock: number
}

export const DEFAULT_INPUTS: UsShotInputs = {
  muzzleVelocityFps: 2700,
  bc: 0.3,
  dragModel: 'G7',
  bulletWeightGr: 140,
  bulletDiameterIn: 0.264,
  sightHeightIn: 2,
  zeroRangeYd: 100,
  twistIn: 8,
  twistDirection: 'right',
  temperatureF: 59,
  atmosphereMode: 'pressure',
  stationPressureInHg: 29.92,
  altitudeFt: 0,
  humidityPct: 0,
  windSpeedMph: 10,
  windClock: 3,
}

const optional = (v: number | undefined, f: (x: number) => number) => (v === undefined ? undefined : f(v))

export function toShotInput(us: UsShotInputs): ShotInput {
  const twist = optional(us.twistIn, u.inchesToMeters)
  const usePressure = us.atmosphereMode === 'pressure'
  return {
    muzzleVelocity: u.fpsToMps(us.muzzleVelocityFps),
    ballisticCoefficient: us.bc,
    dragModel: us.dragModel,
    bulletMass: u.grainsToKg(us.bulletWeightGr),
    bulletDiameter: optional(us.bulletDiameterIn, u.inchesToMeters),
    bulletLength: optional(us.bulletLengthIn, u.inchesToMeters),
    sightHeight: u.inchesToMeters(us.sightHeightIn),
    zeroRange: u.yardsToMeters(us.zeroRangeYd),
    twistRate: twist === undefined ? undefined : us.twistDirection === 'left' ? -twist : twist,
    temperature: u.fahrenheitToKelvin(us.temperatureF),
    stationPressure: usePressure ? optional(us.stationPressureInHg, u.inHgToPa) : undefined,
    altitude: usePressure ? undefined : optional(us.altitudeFt, u.feetToMeters),
    humidity: us.humidityPct / 100,
    windSpeed: u.mphToMps(us.windSpeedMph),
    windDirection: u.clockToRadians(us.windClock),
  }
}
