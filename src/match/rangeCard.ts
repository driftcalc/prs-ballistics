// Range card: elevation and full-value wind (from the left and from the right)
// every 25 or 50 yd out to the max. Only asks the ballistics engine; no formulas.
import { BallisticsError } from '../ballistics/index.ts'
import type { CardRow } from '../data/match.ts'
import type { Conditions, RifleProfile } from '../data/profiles.ts'
import { computeCard } from './cards.ts'

export const RANGE_CARD_START_YD = 100

/** 100, 150, 200 … up to and including maxYd. */
export function rangeCardDistances(stepYd: number, maxYd: number): number[] {
  const out: number[] = []
  for (let yd = RANGE_CARD_START_YD; yd <= maxYd; yd += stepYd) out.push(yd)
  return out
}

export interface RangeCard {
  rows: CardRow[]
  /** Distances the engine couldn't work out (the bullet doesn't get there with these inputs). */
  unreachableYd: number[]
}

/**
 * Works out every row. If the engine can't reach the far end, the rows it can
 * reach are kept and the rest are listed as unreachable (shown as "—"),
 * never guessed.
 */
export async function computeRangeCard(profile: RifleProfile, conditions: Conditions, windsMph: number[], stepYd: number, maxYd: number): Promise<RangeCard> {
  const distances = rangeCardDistances(stepYd, maxYd)
  const asStage = (yds: number[]) => ({ id: 'range-card', name: 'Range card', order: [], targets: yds.map((rangeYd) => ({ name: `${rangeYd}`, rangeYd })) })
  try {
    const card = await computeCard(asStage(distances), profile, conditions, windsMph)
    return { rows: card.rows, unreachableYd: [] }
  } catch (e) {
    if (!(e instanceof BallisticsError)) throw e
  }
  // Something is out of reach: find the farthest distance that works (rows are in order).
  let lo = 0
  let hi = distances.length // distances[hi - 1] fails
  let best: CardRow[] = []
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    try {
      best = (await computeCard(asStage(distances.slice(0, mid + 1)), profile, conditions, windsMph)).rows
      lo = mid + 1
    } catch (e) {
      if (!(e instanceof BallisticsError)) throw e
      hi = mid
    }
  }
  const rows = best.length === lo ? best : lo ? (await computeCard(asStage(distances.slice(0, lo)), profile, conditions, windsMph)).rows : []
  return { rows, unreachableYd: distances.slice(lo) }
}
