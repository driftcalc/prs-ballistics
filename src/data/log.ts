// Dope logbook: shots you fired, with the hold that actually worked next to
// what the app predicted at the time.
import { getEngine } from '../ballistics/index.ts'
import { toShotInput } from '../shotInputs.ts'
import { mpsToFps, radiansToMil, yardsToMeters } from '../units/index.ts'
import { combine, type Conditions, type RifleData, type WindInputs } from './profiles.ts'

export interface Prediction {
  /** mil, up = positive */
  elevationMil: number
  /** mil, right = positive */
  windageMil: number
  velocityFps: number
  timeOfFlightS: number
}

export interface DopeEntry {
  id: string
  profileId: string
  /** Rifle name when logged (in case the rifle is renamed or deleted later). */
  profileName: string
  /** The rifle's values when this shot was logged. */
  rifle: RifleData
  createdAt: string
  rangeYd: number
  conditions: Conditions
  wind: WindInputs
  /** The elevation hold you actually used, mil (up = positive). Blank = null. */
  actualElevationMil: number | null
  /** The windage hold you actually used, mil (right = positive). Blank = null. */
  actualWindageMil: number | null
  /** Ticked when the hold was confirmed on target (only these are used for truing). */
  confirmed: boolean
  notes?: string
  /** What the app predicted for this shot when it was logged. */
  predicted: Prediction
}

/** Runs the ballistics engine for one shot and returns the holds in mil. */
export async function predict(rifle: RifleData, conditions: Conditions, wind: WindInputs, rangeYd: number): Promise<Prediction> {
  const engine = await getEngine()
  const [s] = await engine.solve(toShotInput(combine(rifle, conditions, wind)), [yardsToMeters(rangeYd)])
  return {
    elevationMil: radiansToMil(s.elevation),
    windageMil: radiansToMil(s.windage),
    velocityFps: mpsToFps(s.velocity),
    timeOfFlightS: s.timeOfFlight,
  }
}

/** Checks an entry read from a backup file has the essentials; returns a reason if not. */
export function logEntryProblem(e: Partial<DopeEntry> | undefined): string | undefined {
  if (!e || typeof e !== 'object') return 'not a log entry'
  if (typeof e.id !== 'string' || typeof e.profileId !== 'string') return 'missing id'
  if (typeof e.rangeYd !== 'number' || !(e.rangeYd > 0)) return 'missing range'
  if (!e.rifle || typeof e.rifle.muzzleVelocityFps !== 'number') return 'missing rifle values'
  if (!e.conditions || !e.wind || !e.predicted || typeof e.predicted.elevationMil !== 'number') return 'missing conditions or prediction'
  return undefined
}
