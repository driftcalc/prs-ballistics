// Compares our results with numbers copied from another ballistics app
// (Hornady, Applied Ballistics). Used by the Check accuracy page AND by the
// automatic tests, so both always judge the same way.
import type { BallisticsEngine } from '../ballistics/index.ts'
import { toShotInput, type UsShotInputs } from '../shotInputs.ts'
import { mpsToFps, radiansToMil, yardsToMeters } from '../units/index.ts'

/**
 * Largest allowed difference, in mil. Fixed by the project owner.
 * NEVER raise this to make a test pass (see CLAUDE.md).
 */
export const TOLERANCE_MIL = 0.1

// Ignores floating-point noise only (e.g. 0.1000000000002), not real differences.
const FLOAT_NOISE = 1e-9

export const RANGES_YD = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

export const SOURCES = ['Hornady', 'Applied Ballistics', 'Other'] as const
export type Source = (typeof SOURCES)[number]

/** One row as typed from the other app. Blank = null. */
export interface ReferenceRow {
  rangeYd: number
  /** Elevation correction, mil. Up = positive. */
  elevationMil: number | null
  /** Windage correction, mil. Right = positive, left = negative. */
  windageMil: number | null
  velocityFps?: number | null
  timeOfFlightS?: number | null
}

export interface ReferenceCase {
  name: string
  source: Source
  appVersion?: string
  notes?: string
  createdAt: string
  inputs: UsShotInputs
  rows: ReferenceRow[]
}

export interface ComparedRow {
  rangeYd: number
  theirs: ReferenceRow
  ours: { elevationMil: number; windageMil: number; velocityFps: number; timeOfFlightS: number }
  /** Ours minus theirs, mil. Null when they left it blank. */
  elevationDiff: number | null
  windageDiff: number | null
  /** True = within tolerance, false = flagged, null = nothing to compare. */
  elevationOk: boolean | null
  windageOk: boolean | null
}

const within = (diff: number | null) => (diff === null ? null : Math.abs(diff) <= TOLERANCE_MIL + FLOAT_NOISE)

export async function compareCase(c: ReferenceCase, engine: BallisticsEngine): Promise<ComparedRow[]> {
  const ours = await engine.solve(
    toShotInput(c.inputs),
    c.rows.map((r) => yardsToMeters(r.rangeYd)),
  )
  return c.rows.map((theirs, i) => {
    const o = ours[i]
    const elevationMil = radiansToMil(o.elevation)
    const windageMil = radiansToMil(o.windage)
    const elevationDiff = theirs.elevationMil === null ? null : elevationMil - theirs.elevationMil
    const windageDiff = theirs.windageMil === null ? null : windageMil - theirs.windageMil
    return {
      rangeYd: theirs.rangeYd,
      theirs,
      ours: { elevationMil, windageMil, velocityFps: mpsToFps(o.velocity), timeOfFlightS: o.timeOfFlight },
      elevationDiff,
      windageDiff,
      elevationOk: within(elevationDiff),
      windageOk: within(windageDiff),
    }
  })
}

/** Rows where elevation or windage is over the tolerance. */
export const flaggedRows = (rows: ComparedRow[]) =>
  rows.filter((r) => r.elevationOk === false || r.windageOk === false)

export function emptyRows(): ReferenceRow[] {
  return RANGES_YD.map((rangeYd) => ({ rangeYd, elevationMil: null, windageMil: null, velocityFps: null, timeOfFlightS: null }))
}

/**
 * Reads a mil value as typed. Accepts "1.2", "-0.4", and the app styles
 * "U 1.2" / "D 0.1" / "L 0.4" / "R 0.4" (also "0.4L"). Blank = null.
 */
export function parseMil(text: string): number | null {
  const t = text.trim().toUpperCase().replace(',', '.').replace(/\s+/g, '')
  if (t === '') return null
  const m = /^([UDLR]?)([+-]?\d*\.?\d+)([UDLR]?)$/.exec(t)
  if (!m || (m[1] && m[3])) return NaN
  const dir = m[1] || m[3]
  const n = Number(m[2])
  return dir === 'L' || dir === 'D' ? -Math.abs(n) : dir === 'U' || dir === 'R' ? Math.abs(n) : n
}

/** Checks a test case file has everything needed; throws a readable message if not. */
export function validateCase(data: unknown, label: string): ReferenceCase {
  const c = data as Partial<ReferenceCase>
  const problems: string[] = []
  if (!c || typeof c !== 'object') throw new Error(`${label}: not a test case`)
  if (typeof c.name !== 'string') problems.push('missing name')
  if (!SOURCES.includes(c.source as Source)) problems.push('unknown source')
  if (!c.inputs || typeof c.inputs.muzzleVelocityFps !== 'number') problems.push('missing inputs')
  if (!Array.isArray(c.rows) || c.rows.length === 0) problems.push('no rows')
  if (problems.length) throw new Error(`${label}: ${problems.join(', ')}`)
  return c as ReferenceCase
}
