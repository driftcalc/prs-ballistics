// Truing assistant: compares confirmed holds from the logbook with what the
// ballistics engine predicts, works out whether muzzle velocity (MV), BC, or the
// zero looks wrong, and suggests a corrected value.
//
// No ballistics formulas here: every prediction comes from the engine
// (via predict). We only "turn the dial" on MV or BC and re-run the engine
// until the predictions line up with your holds as closely as possible.
import type { DopeEntry } from '../data/log.ts'
import { predict } from '../data/log.ts'
import type { Conditions, RifleData, WindInputs } from '../data/profiles.ts'

export interface TruingPoint {
  rangeYd: number
  /** Elevation hold that hit, mil (up = positive). */
  actualMil: number
  conditions: Conditions
  wind: WindInputs
}

export type Verdict = 'need-more' | 'matches' | 'mv' | 'bc' | 'zero' | 'unclear'

export interface TruingRow {
  rangeYd: number
  actualMil: number
  /** With the rifle's current values. */
  currentMil: number
  /** With the suggested value (when there is one). */
  suggestedMil?: number
}

export interface Suggestion {
  field: 'muzzleVelocityFps' | 'bc'
  current: number
  suggested: number
}

export interface TruingResult {
  verdict: Verdict
  headline: string
  explanation: string
  rows: TruingRow[]
  /** Only for a clear MV or BC verdict. */
  suggestion?: Suggestion
  /** Both candidate values, shown for information when the verdict is unclear. */
  candidates?: { mv: number; bc: number }
  /** How well each explanation fits your holds (RMS error, mil; smaller = better). */
  fits?: { mv: number; bc: number; zero: number }
  /** Click size your holds appear to be rounded to (mil), 0 if not rounded. */
  resolutionMil?: number
  warning?: string
}

/** Holds within this of the prediction count as "matching" (same as Check accuracy). */
export const MATCH_MIL = 0.1
/** Logged distances must span at least this much. */
export const MIN_SPREAD_YD = 100
const MV_RANGE = [0.85, 1.15] // search 85%..115% of the current MV
const BC_RANGE = [0.6, 1.5] // search 60%..150% of the current BC
const SEARCH_STEPS = 24
/** How many times the typical rounding error the gap between explanations must exceed. */
const NOISE_MARGIN = 2

const MIL_PER_MOA = (Math.PI / 10800) * 1000

/**
 * The click size the holds were rounded to: 0.1 / 0.05 / 0.025 mil, or
 * 1 / 0.5 / 0.25 MOA (holds typed in MOA). 0 = not rounded (exact values).
 */
export function holdResolutionMil(holds: number[]): number {
  const isMultiple = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6
  for (const step of [0.1, 0.05, 0.025]) if (holds.every((h) => isMultiple(h, step))) return step
  for (const moa of [1, 0.5, 0.25]) if (holds.every((h) => isMultiple(h / MIL_PER_MOA, moa))) return moa * MIL_PER_MOA
  return 0
}

/** Confirmed log entries for one rifle that have an elevation hold. */
export function truingPoints(log: DopeEntry[], profileId: string): TruingPoint[] {
  return log
    .filter((e) => e.profileId === profileId && e.confirmed && e.actualElevationMil !== null)
    .map((e) => ({ rangeYd: e.rangeYd, actualMil: e.actualElevationMil!, conditions: e.conditions, wind: e.wind }))
}

async function predictAll(rifle: RifleData, points: TruingPoint[]): Promise<number[]> {
  const out: number[] = []
  for (const p of points) out.push((await predict(rifle, p.conditions, p.wind, p.rangeYd)).elevationMil)
  return out
}

const rms = (xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length)
const misses = (actual: number[], predicted: number[]) => actual.map((a, i) => a - predicted[i])

/**
 * Golden-section search: finds the value in [lo, hi] where `cost` is smallest.
 * Like turning a dial left and right, halving the gap each time.
 */
async function bestValue(lo: number, hi: number, cost: (v: number) => Promise<number>): Promise<number> {
  const g = (Math.sqrt(5) - 1) / 2
  let a = lo
  let b = hi
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  let fc = await cost(c)
  let fd = await cost(d)
  for (let i = 0; i < SEARCH_STEPS; i++) {
    if (fc < fd) {
      b = d
      d = c
      fd = fc
      c = b - g * (b - a)
      fc = await cost(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + g * (b - a)
      fd = await cost(d)
    }
  }
  return (a + b) / 2
}

/** Cost of a trial rifle: how far its predictions are from your holds (RMS, mil). Out-of-reach = huge. */
async function fitCost(rifle: RifleData, points: TruingPoint[], actual: number[]): Promise<number> {
  try {
    return rms(misses(actual, await predictAll(rifle, points)))
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

const f2 = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`

export async function analyseTruing(rifle: RifleData, points: TruingPoint[]): Promise<TruingResult> {
  const ranges = points.map((p) => p.rangeYd)
  const spread = ranges.length ? Math.max(...ranges) - Math.min(...ranges) : 0
  if (points.length < 2 || spread < MIN_SPREAD_YD) {
    return {
      verdict: 'need-more',
      headline: 'Need confirmed holds at 2 or more distances',
      explanation:
        `Log confirmed elevation holds at at least two distances ${MIN_SPREAD_YD}+ yd apart ` +
        '(ideally one around 500–700 yd and one at your longest range). Tick "Confirmed on target" when you log them.',
      rows: [],
    }
  }

  const actual = points.map((p) => p.actualMil)
  const current = await predictAll(rifle, points)
  const r = misses(actual, current)
  const rowsWith = (suggested?: number[]): TruingRow[] =>
    points.map((p, i) => ({ rangeYd: p.rangeYd, actualMil: actual[i], currentMil: current[i], suggestedMil: suggested?.[i] }))

  if (r.every((x) => Math.abs(x) <= MATCH_MIL)) {
    return {
      verdict: 'matches',
      headline: 'Your rifle already matches your dope',
      explanation: `Every confirmed hold is within ${MATCH_MIL} mil of the prediction. No change needed.`,
      rows: rowsWith(),
    }
  }

  // Three explanations to test, each with one "dial":
  //  - MV wrong: change MV only.   - BC wrong: change BC only.
  //  - Zero / scope offset: the same correction at every distance.
  const mvBest = Math.round(
    await bestValue(rifle.muzzleVelocityFps * MV_RANGE[0], rifle.muzzleVelocityFps * MV_RANGE[1], (mv) =>
      fitCost({ ...rifle, muzzleVelocityFps: mv }, points, actual),
    ),
  )
  const bcBest =
    Math.round(
      (await bestValue(rifle.bc * BC_RANGE[0], rifle.bc * BC_RANGE[1], (bc) => fitCost({ ...rifle, bc }, points, actual))) * 1000,
    ) / 1000
  const mvPred = await predictAll({ ...rifle, muzzleVelocityFps: mvBest }, points)
  const bcPred = await predictAll({ ...rifle, bc: bcBest }, points)
  const offset = r.reduce((s, x) => s + x, 0) / r.length

  const fits = [
    { verdict: 'mv' as const, err: rms(misses(actual, mvPred)) },
    { verdict: 'bc' as const, err: rms(misses(actual, bcPred)) },
    { verdict: 'zero' as const, err: rms(r.map((x) => x - offset)) },
  ].sort((a, b) => a.err - b.err)
  const [best, second] = fits
  // Holds dialed to 0.1 mil carry up to ±0.05 mil of rounding. A difference
  // between explanations smaller than that rounding can't be trusted.
  const resolutionMil = holdResolutionMil(actual)
  const noise = resolutionMil / Math.sqrt(12) // typical (RMS) rounding error
  // "Clear" = the best explanation fits clearly better than the next one, by
  // more than the rounding in your holds could cause.
  const clear = best.err <= 0.6 * second.err && second.err - best.err >= Math.max(0.02, NOISE_MARGIN * noise)
  const fitSummary = {
    fits: Object.fromEntries(fits.map((f) => [f.verdict, f.err])) as TruingResult['fits'],
    resolutionMil,
  }

  const poorFit =
    best.err > MATCH_MIL
      ? `Even the best explanation leaves about ${best.err.toFixed(2)} mil of error — double-check the logged holds, wind and weather for these shots.`
      : undefined

  if (!clear) {
    return {
      verdict: 'unclear',
      headline: "Can't tell yet whether it's muzzle velocity or BC",
      explanation:
        'Your holds can be explained about equally well by a different muzzle velocity ' +
        `(about ${mvBest} fps) or a different BC (about ${bcBest.toFixed(3)}). ` +
        'Usual approach: true muzzle velocity first with confirmed holds around 500–700 yd, then true BC with holds at your longest range (where BC matters most).',
      rows: rowsWith(),
      candidates: { mv: mvBest, bc: bcBest },
      ...fitSummary,
      warning: poorFit,
    }
  }

  if (best.verdict === 'zero') {
    return {
      verdict: 'zero',
      ...fitSummary,
      headline: 'Looks like your zero or scope, not MV or BC',
      explanation:
        `Every distance is off by about the same amount (${f2(offset)} mil). MV and BC errors grow with distance; a constant error points to the zero. ` +
        'Re-check your zero first. If the zero is good, your scope may not track exactly (do a tall-target test).',
      rows: rowsWith(),
      warning: poorFit,
    }
  }

  const isMv = best.verdict === 'mv'
  const suggestion: Suggestion = isMv
    ? { field: 'muzzleVelocityFps', current: rifle.muzzleVelocityFps, suggested: mvBest }
    : { field: 'bc', current: rifle.bc, suggested: bcBest }
  const change = Math.abs(suggestion.suggested - suggestion.current) / suggestion.current
  const big = isMv ? change > 0.05 : change > 0.2
  const direction = (actual.reduce((s, a, i) => s + a - current[i], 0) > 0 ? 'more' : 'less') + ' elevation than predicted'

  return {
    verdict: best.verdict,
    ...fitSummary,
    headline: isMv ? 'Looks like a muzzle velocity problem' : 'Looks like a BC / drag problem',
    explanation: isMv
      ? `You needed ${direction}, and the difference is already there at mid range and grows steadily — that's the pattern of a muzzle velocity that's off. ` +
        `Try MV ${mvBest} fps (now ${rifle.muzzleVelocityFps}).`
      : `You needed ${direction}, with little difference at shorter range and a bigger one far out — that's the pattern of a BC that's off. ` +
        `Try BC ${bcBest.toFixed(3)} (now ${rifle.bc.toFixed(3)}).`,
    rows: rowsWith(isMv ? mvPred : bcPred),
    suggestion,
    warning:
      [big ? `That's a big change (${(change * 100).toFixed(0)}%). Double-check your chronograph, zero and the logged holds before applying it.` : '', poorFit ?? '']
        .filter(Boolean)
        .join(' ') || undefined,
  }
}
