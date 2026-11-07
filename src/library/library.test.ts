import { describe, expect, it } from 'vitest'
import { CARTRIDGES, FACTORY_LOADS, searchLoads } from './ammo.ts'
import { estimateVelocity, FPS_PER_INCH } from './barrelEstimate.ts'

// Sensible limits per cartridge, to catch typos like 27100 fps or a BC of 3.1.
const LIMITS = {
  '6.5 Creedmoor': { diameter: 0.264, gr: [95, 160], fps: [2400, 3100] },
  '6mm Creedmoor': { diameter: 0.243, gr: [80, 120], fps: [2700, 3300] },
  '.308 Win': { diameter: 0.308, gr: [140, 200], fps: [2400, 3000] },
} as const

describe('factory ammo library', () => {
  it('has unique ids', () => {
    const ids = FACTORY_LOADS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const l of FACTORY_LOADS) {
    it(`${l.id} is complete and in sensible ranges`, () => {
      const lim = LIMITS[l.cartridge]
      expect(CARTRIDGES).toContain(l.cartridge)
      expect(l.brand && l.product).toBeTruthy()
      expect(l.bulletDiameterIn).toBe(lim.diameter)
      expect(l.bulletWeightGr).toBeGreaterThanOrEqual(lim.gr[0])
      expect(l.bulletWeightGr).toBeLessThanOrEqual(lim.gr[1])
      expect(l.muzzleVelocityFps).toBeGreaterThanOrEqual(lim.fps[0])
      expect(l.muzzleVelocityFps).toBeLessThanOrEqual(lim.fps[1])
      expect(l.testBarrelIn).toBeGreaterThanOrEqual(18)
      expect(l.testBarrelIn).toBeLessThanOrEqual(30)
      // G7 BCs for these bullets are roughly 0.2–0.4; G1 roughly 0.4–0.8.
      if (l.dragModel === 'G7') expect(l.bc).toBeGreaterThan(0.2)
      if (l.dragModel === 'G7') expect(l.bc).toBeLessThan(0.4)
      if (l.bulletLengthIn !== undefined) {
        expect(l.bulletLengthIn).toBeGreaterThan(0.9)
        expect(l.bulletLengthIn).toBeLessThan(1.8)
      }
      expect(l.source).toMatch(/^https:\/\//)
      expect(l.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  }

  it('every cartridge has a velocity-per-inch figure with a source', () => {
    for (const c of CARTRIDGES) expect(FPS_PER_INCH[c].source.length).toBeGreaterThan(10)
  })

  it('search matches brand, cartridge and weight words in any order', () => {
    expect(searchLoads('hornady 6.5').map((l) => l.id)).toEqual(['hornady-65cm-140-eldm'])
    expect(searchLoads('175 308').map((l) => l.id).sort()).toEqual(['federal-gm-308-175-smk', 'lapua-308-175-scenar-l'])
    expect(searchLoads('').length).toBe(FACTORY_LOADS.length)
    expect(searchLoads('GM308M2').map((l) => l.id)).toEqual(['federal-gm-308-175-smk'])
  })
})

describe('barrel-length velocity estimate', () => {
  const hornady140 = FACTORY_LOADS.find((l) => l.id === 'hornady-65cm-140-eldm')!

  it('subtracts fps-per-inch for a shorter barrel (24″ test → 22″)', () => {
    const e = estimateVelocity(hornady140, 22)
    expect(e.fps).toBe(2710 - 2 * 20)
    expect(e.adjusted).toBe(true)
    expect(e.plusMinus).toBe(35) // 25 base + 2 in × 6
  })

  it('adds for a longer barrel', () => {
    expect(estimateVelocity(hornady140, 26).fps).toBe(2710 + 2 * 20)
  })

  it('uses the published value as-is when no barrel length is given', () => {
    const e = estimateVelocity(hornady140, undefined)
    expect(e).toMatchObject({ fps: 2710, adjusted: false })
  })

  it('keeps silly barrel lengths within 16–32″', () => {
    const short = estimateVelocity(hornady140, 8)
    expect(short.barrelIn).toBe(16)
    expect(short.clamped).toBe(true)
    expect(short.fps).toBe(2710 - 8 * 20)
    expect(estimateVelocity(hornady140, 40).barrelIn).toBe(32)
  })

  it('uses the right figure per cartridge', () => {
    const lapua308 = FACTORY_LOADS.find((l) => l.id === 'lapua-308-175-scenar-l')!
    expect(estimateVelocity(lapua308, 20).fps).toBe(2602 - 6 * 23) // 26″ test barrel
  })
})
