// What the big +/- buttons on the Shoot screen do. Kept separate from the
// screen so it can be tested.

export const MIN_RANGE_YD = 25
export const MAX_RANGE_YD = 3000
export const RANGE_STEPS_YD = [10, 25, 50, 100]
export const MAX_WIND_MPH = 60

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Moves the range one step up or down, landing on whole steps:
 * 637 + 25 -> 650, 637 - 25 -> 625.
 */
export function stepRange(rangeYd: number, stepYd: number, direction: 1 | -1): number {
  const next =
    direction > 0 ? Math.floor(rangeYd / stepYd) * stepYd + stepYd : Math.ceil(rangeYd / stepYd) * stepYd - stepYd
  return clamp(next, MIN_RANGE_YD, MAX_RANGE_YD)
}

export function stepWindSpeed(mph: number, direction: 1 | -1): number {
  return clamp(Math.round(mph) + direction, 0, MAX_WIND_MPH)
}

/** Turns the wind clock one hour: 12 -> 1 going clockwise, 1 -> 12 going back. */
export function rotateClock(hour: number, direction: 1 | -1): number {
  return ((((hour - 1 + direction) % 12) + 12) % 12) + 1
}
