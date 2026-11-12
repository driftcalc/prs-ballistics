import { describe, expect, it } from 'vitest'
import { FACTORY_LOADS } from '../library/ammo.ts'
import { sampleRifle } from './firstRun.ts'

describe('sample rifle', () => {
  it("uses the maker's published figures from the library and says it's a sample", () => {
    const load = FACTORY_LOADS.find((l) => l.id === 'hornady-65cm-140-eldm')!
    const p = sampleRifle()
    expect(p.name).toMatch(/^Sample · 6\.5 Creedmoor 140 gr$/)
    expect(p.notes).toMatch(/Sample rifle/)
    expect(p.rifle).toMatchObject({
      muzzleVelocityFps: load.muzzleVelocityFps,
      bc: load.bc,
      dragModel: load.dragModel,
      bulletWeightGr: load.bulletWeightGr,
      bulletDiameterIn: load.bulletDiameterIn,
    })
    // Velocity is the published figure, so it's marked as an estimate until trued.
    expect(p.factory).toEqual({ loadId: load.id, mvEstimated: true })
  })
})
