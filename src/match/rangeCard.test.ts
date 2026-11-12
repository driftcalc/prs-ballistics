import { describe, expect, it } from 'vitest'
import { predict } from '../data/log.ts'
import { DEFAULT_CONDITIONS, DEFAULT_RIFLE, type RifleProfile } from '../data/profiles.ts'
import { radiansToMil } from '../units/index.ts'
import { computeRangeCard, rangeCardDistances } from './rangeCard.ts'

const profile: RifleProfile = { id: 'r', name: '6.5 CM', rifle: { ...DEFAULT_RIFLE, bulletLengthIn: 1.35 }, updatedAt: '' }

describe('range card', () => {
  it('rows run from 100 yd to the max in the chosen step', () => {
    expect(rangeCardDistances(50, 300)).toEqual([100, 150, 200, 250, 300])
    expect(rangeCardDistances(25, 200)).toEqual([100, 125, 150, 175, 200])
  })

  it('every row equals a single-shot prediction (elevation calm, wind both sides)', async () => {
    const card = await computeRangeCard(profile, DEFAULT_CONDITIONS, [5, 10], 100, 800)
    expect(card.unreachableYd).toEqual([])
    expect(card.rows.map((r) => r.rangeYd)).toEqual([100, 200, 300, 400, 500, 600, 700, 800])
    for (const row of card.rows) {
      const calm = await predict(profile.rifle, DEFAULT_CONDITIONS, { windSpeedMph: 0, windClock: 3 }, row.rangeYd)
      expect(radiansToMil(row.elevationRad)).toBeCloseTo(calm.elevationMil, 9)
      for (const w of row.wind) {
        const left = await predict(profile.rifle, DEFAULT_CONDITIONS, { windSpeedMph: w.mph, windClock: 9 }, row.rangeYd)
        const right = await predict(profile.rifle, DEFAULT_CONDITIONS, { windSpeedMph: w.mph, windClock: 3 }, row.rangeYd)
        expect(radiansToMil(w.fromLeftRad)).toBeCloseTo(left.windageMil, 9)
        expect(radiansToMil(w.fromRightRad)).toBeCloseTo(right.windageMil, 9)
      }
    }
  })

  it('keeps the rows the bullet reaches and lists the rest as unreachable, never guessed', async () => {
    // A slow, draggy bullet that can't get to 3000 yd.
    const slow: RifleProfile = { ...profile, rifle: { ...profile.rifle, muzzleVelocityFps: 1050, bc: 0.05, dragModel: 'G1', bulletWeightGr: 40 } }
    const card = await computeRangeCard(slow, DEFAULT_CONDITIONS, [10], 50, 3000)
    expect(card.unreachableYd.length).toBeGreaterThan(0)
    expect(card.unreachableYd.at(-1)).toBe(3000)
    const last = card.rows.at(-1)?.rangeYd ?? 50
    expect(card.unreachableYd[0]).toBe(last + 50)
  })
})
