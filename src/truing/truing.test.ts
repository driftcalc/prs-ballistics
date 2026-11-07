// Known-answer tests. "Your holds" are made up by running the engine with a
// TRUE value the assistant isn't told; it must work out what was wrong and
// suggest a value close to the truth.
import { describe, expect, it } from 'vitest'
import { predict } from '../data/log.ts'
import { DEFAULT_CONDITIONS, DEFAULT_RIFLE, type RifleData } from '../data/profiles.ts'
import { analyseTruing, holdResolutionMil, type TruingPoint } from './truing.ts'

// The rifle as entered in the app: 6.5 Creedmoor, 2700 fps, G7 0.300.
const entered: RifleData = { ...DEFAULT_RIFLE, muzzleVelocityFps: 2700, bc: 0.3, bulletLengthIn: 1.35 }
const noWind = { windSpeedMph: 0, windClock: 3 }

/** Holds you'd have confirmed if the rifle really had `truth` values. */
async function holdsFor(truth: RifleData, ranges: number[], adjust: (mil: number, i: number) => number = (m) => m): Promise<TruingPoint[]> {
  const points: TruingPoint[] = []
  for (const [i, rangeYd] of ranges.entries()) {
    const p = await predict(truth, DEFAULT_CONDITIONS, noWind, rangeYd)
    points.push({ rangeYd, actualMil: adjust(p.elevationMil, i), conditions: DEFAULT_CONDITIONS, wind: noWind })
  }
  return points
}

/** Rounds to 0.1 mil, the way you'd actually dial it. */
const dialed = (mil: number) => Math.round(mil * 10) / 10

describe('click size of logged holds', () => {
  it('recognises 0.1 mil clicks, 0.25 MOA clicks and exact values', () => {
    expect(holdResolutionMil([1.2, 3.4, 5.0])).toBe(0.1)
    expect(holdResolutionMil([1.25, 3.4])).toBe(0.05)
    const moa = (n: number) => (n * Math.PI * 1000) / 10800
    expect(holdResolutionMil([moa(4.25), moa(13.5)])).toBeCloseTo(moa(0.25), 9)
    expect(holdResolutionMil([1.2345])).toBe(0)
  })
})

describe('truing assistant (known answers)', () => {
  it('finds a muzzle velocity that is 50 fps too high', async () => {
    const holds = await holdsFor({ ...entered, muzzleVelocityFps: 2650 }, [300, 600, 900])
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('mv')
    expect(r.suggestion?.field).toBe('muzzleVelocityFps')
    expect(Math.abs(r.suggestion!.suggested - 2650)).toBeLessThanOrEqual(5)
    // With the suggestion, every prediction should match your holds.
    for (const row of r.rows) expect(Math.abs(row.suggestedMil! - row.actualMil)).toBeLessThan(0.02)
  })

  it('finds a BC that is 0.02 too high', async () => {
    const holds = await holdsFor({ ...entered, bc: 0.28 }, [300, 600, 1000])
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('bc')
    expect(r.suggestion?.field).toBe('bc')
    expect(Math.abs(r.suggestion!.suggested - 0.28)).toBeLessThanOrEqual(0.003)
  })

  it('finds a BC that is too low (holds need less elevation)', async () => {
    const holds = await holdsFor({ ...entered, bc: 0.32 }, [400, 700, 1000])
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('bc')
    expect(Math.abs(r.suggestion!.suggested - 0.32)).toBeLessThanOrEqual(0.003)
    expect(r.explanation).toMatch(/less elevation/)
  })

  it('blames the zero when every distance is off by the same 0.2 mil', async () => {
    const holds = await holdsFor(entered, [300, 600, 900], (m) => m + 0.2)
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('zero')
    expect(r.suggestion).toBeUndefined()
    expect(r.explanation).toMatch(/\+0\.20 mil/)
  })

  it('says no change is needed when holds match the predictions', async () => {
    const r = await analyseTruing(entered, await holdsFor(entered, [300, 600, 900]))
    expect(r.verdict).toBe('matches')
    expect(r.suggestion).toBeUndefined()
  })

  it('asks for another distance when there is only one', async () => {
    const r = await analyseTruing(entered, await holdsFor({ ...entered, muzzleVelocityFps: 2650 }, [600, 600]))
    expect(r.verdict).toBe('need-more')
  })

  it('asks for another distance when distances are too close together', async () => {
    const r = await analyseTruing(entered, await holdsFor({ ...entered, muzzleVelocityFps: 2650 }, [600, 650]))
    expect(r.verdict).toBe('need-more')
  })

  it('still finds a real MV error when holds are rounded to 0.1 mil like real dialing', async () => {
    const holds = await holdsFor({ ...entered, muzzleVelocityFps: 2620 }, [300, 500, 700, 900, 1000], dialed)
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('mv')
    expect(Math.abs(r.suggestion!.suggested - 2620)).toBeLessThanOrEqual(15)
  })

  it('still finds a real BC error when holds are rounded to 0.1 mil', async () => {
    const holds = await holdsFor({ ...entered, bc: 0.27 }, [300, 500, 700, 900, 1100], dialed)
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('bc')
    expect(Math.abs(r.suggestion!.suggested - 0.27)).toBeLessThanOrEqual(0.006)
  })

  it("says it can't tell (instead of guessing) when close distances and rounding hide the pattern", async () => {
    const holds = await holdsFor({ ...entered, muzzleVelocityFps: 2650 }, [500, 600], dialed)
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('unclear')
    expect(r.suggestion).toBeUndefined()
  })

  it('warns when the suggested change is unusually big', async () => {
    const holds = await holdsFor({ ...entered, muzzleVelocityFps: 2500 }, [300, 600, 900])
    const r = await analyseTruing(entered, holds)
    expect(r.verdict).toBe('mv')
    expect(r.warning).toMatch(/big change/)
  })

  it('never changes the rifle it was given', async () => {
    const rifle = Object.freeze({ ...entered })
    const holds = await holdsFor({ ...entered, muzzleVelocityFps: 2650 }, [300, 600, 900])
    await analyseTruing(rifle, holds)
    expect(rifle).toEqual(entered)
  })
})
