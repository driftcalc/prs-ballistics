// Stage card numbers must be exactly what Shoot (and the logbook) show for the
// same rifle, weather, range and wind.
import { describe, expect, it } from 'vitest'
import { cardIsStale, type Stage } from '../data/match.ts'
import { predict } from '../data/log.ts'
import { DEFAULT_CONDITIONS, DEFAULT_RIFLE, type RifleProfile } from '../data/profiles.ts'
import { radiansToMil } from '../units/index.ts'
import { computeCard } from './cards.ts'

const profile: RifleProfile = {
  id: 'r1',
  name: '6.5 CM',
  rifle: { ...DEFAULT_RIFLE, bulletLengthIn: 1.35 }, // spin drift on
  updatedAt: '',
}
const stage: Stage = {
  id: 's1',
  name: 'Stage 1',
  targets: [
    { name: 'T1', rangeYd: 611 },
    { name: 'T2', rangeYd: 1000 },
  ],
  order: [],
}

describe('stage cards', () => {
  it('match a single-shot prediction for every target, wind speed and side', async () => {
    const card = await computeCard(stage, profile, DEFAULT_CONDITIONS, [5, 10])
    expect(card.rows.map((r) => r.name)).toEqual(['T1', 'T2'])
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

  it('wind from the left is held left, from the right held right; spin drift makes them differ', async () => {
    const card = await computeCard(stage, profile, DEFAULT_CONDITIONS, [10])
    const w = card.rows[1].wind[0]
    expect(w.fromLeftRad).toBeLessThan(0)
    expect(w.fromRightRad).toBeGreaterThan(0)
    // Right-twist spin drift goes right, so the left hold is the bigger one.
    expect(Math.abs(w.fromLeftRad)).toBeGreaterThan(Math.abs(w.fromRightRad))
  })

  it('a card goes stale when weather, rifle, wind speeds or targets change', async () => {
    const card = await computeCard(stage, profile, DEFAULT_CONDITIONS, [5, 10])
    const s = { ...stage, card }
    expect(cardIsStale(s, profile.rifle, DEFAULT_CONDITIONS, [5, 10])).toBe(false)
    expect(cardIsStale(s, profile.rifle, { ...DEFAULT_CONDITIONS, temperatureF: 80 }, [5, 10])).toBe(true)
    expect(cardIsStale(s, { ...profile.rifle, muzzleVelocityFps: 2750 }, DEFAULT_CONDITIONS, [5, 10])).toBe(true)
    expect(cardIsStale(s, profile.rifle, DEFAULT_CONDITIONS, [4, 8])).toBe(true)
    expect(cardIsStale({ ...s, targets: [{ name: 'T1', rangeYd: 620 }] }, profile.rifle, DEFAULT_CONDITIONS, [5, 10])).toBe(true)
    expect(cardIsStale({ ...stage }, profile.rifle, DEFAULT_CONDITIONS, [5, 10])).toBe(true) // never worked out
  })
})
