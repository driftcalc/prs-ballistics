import { describe, expect, it } from 'vitest'
import { DEFAULT_RIFLE, type RifleProfile } from '../data/profiles.ts'
import { applySuggestion, revertableChange, revertLastChange } from './apply.ts'

const rifle = (): RifleProfile => ({
  id: 'r',
  name: '6.5',
  notes: 'Barrel 2',
  rifle: { ...DEFAULT_RIFLE, muzzleVelocityFps: 2710 },
  factory: { loadId: 'hornady-65cm-140-eldm', mvEstimated: true },
  updatedAt: '',
})

describe('apply and revert a truing suggestion', () => {
  it('changes only the suggested value, notes the old one, and keeps it for revert', () => {
    const p = rifle()
    applySuggestion(p, { field: 'muzzleVelocityFps', current: 2710, suggested: 2745 }, new Date('2026-11-11T10:00:00Z'))
    expect(p.rifle).toEqual({ ...DEFAULT_RIFLE, muzzleVelocityFps: 2745 })
    expect(p.factory?.mvEstimated).toBe(false)
    expect(p.notes).toMatch(/^Barrel 2 Trued muzzle velocity 2710 fps → 2745 fps on /)
    expect(p.truingHistory).toEqual([{ field: 'muzzleVelocityFps', from: 2710, to: 2745, at: '2026-11-11T10:00:00.000Z', mvWasEstimated: true }])
  })

  it('revert puts the rifle back exactly (including the "estimated" flag)', () => {
    const p = rifle()
    applySuggestion(p, { field: 'muzzleVelocityFps', current: 2710, suggested: 2745 })
    expect(revertLastChange(p)).toBe(true)
    expect(p.rifle).toEqual(rifle().rifle)
    expect(p.factory?.mvEstimated).toBe(true)
    expect(p.truingHistory).toEqual([])
    expect(p.notes).toMatch(/Undid truing: muzzle velocity back to 2710 fps/)
  })

  it('BC works the same way', () => {
    const p = rifle()
    applySuggestion(p, { field: 'bc', current: 0.3, suggested: 0.292 })
    expect(p.rifle.bc).toBe(0.292)
    revertLastChange(p)
    expect(p.rifle.bc).toBe(0.3)
  })

  it("won't revert if the value was changed by hand since", () => {
    const p = rifle()
    applySuggestion(p, { field: 'muzzleVelocityFps', current: 2710, suggested: 2745 })
    p.rifle.muzzleVelocityFps = 2760
    expect(revertableChange(p)).toBeUndefined()
    expect(revertLastChange(p)).toBe(false)
    expect(p.rifle.muzzleVelocityFps).toBe(2760)
  })

  it('nothing to revert on a rifle that was never trued', () => {
    expect(revertLastChange(rifle())).toBe(false)
  })
})
