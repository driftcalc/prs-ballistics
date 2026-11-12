// Sanity checks: does the wrapper pass things to the library the right way round?
// These are NOT accuracy checks against other apps; see reference.test.ts for those.
import { describe, expect, it } from 'vitest'
import { BallisticsError, getEngine, type ShotInput } from './index.ts'

const YARD = 0.9144

// A typical 6.5 Creedmoor load, written directly in SI.
const base: ShotInput = {
  muzzleVelocity: 822.96, // 2700 fps
  ballisticCoefficient: 0.3,
  dragModel: 'G7',
  bulletMass: 0.009072, // 140 gr
  bulletDiameter: 0.0067056, // 0.264 in
  sightHeight: 0.0508, // 2 in
  zeroRange: 100 * YARD,
  temperature: 288.15, // 59 F
  stationPressure: 101325,
  humidity: 0,
  windSpeed: 0,
  windDirection: 0,
}

const MPH = 0.44704
const solveAt = async (input: ShotInput, yards: number) => (await (await getEngine()).solve(input, [yards * YARD]))[0]

describe('ballistics wrapper', () => {
  it('needs almost no correction at the zero range', async () => {
    const s = await solveAt(base, 100)
    expect(Math.abs(s.elevation)).toBeLessThan(0.00001)
  })

  it('needs more elevation the further away the target is', async () => {
    const engine = await getEngine()
    const rows = await engine.solve(base, [300, 600, 900].map((y) => y * YARD))
    expect(rows[0].elevation).toBeGreaterThan(0)
    expect(rows[1].elevation).toBeGreaterThan(rows[0].elevation)
    expect(rows[2].elevation).toBeGreaterThan(rows[1].elevation)
    expect(rows[2].velocity).toBeLessThan(rows[0].velocity)
    expect(rows[2].timeOfFlight).toBeGreaterThan(rows[0].timeOfFlight)
  })

  it('returns the exact distances asked for', async () => {
    const engine = await getEngine()
    const rows = await engine.solve(base, [237 * YARD, 1000 * YARD])
    expect(rows.map((r) => r.range)).toEqual([237 * YARD, 1000 * YARD])
  })

  it('wind from 3 o\'clock (right) needs a right correction', async () => {
    const s = await solveAt({ ...base, windSpeed: 10 * MPH, windDirection: Math.PI / 2 }, 600)
    expect(s.windage).toBeGreaterThan(0)
  })

  it('wind from 9 o\'clock (left) needs the same correction to the left', async () => {
    const right = await solveAt({ ...base, windSpeed: 10 * MPH, windDirection: Math.PI / 2 }, 600)
    const left = await solveAt({ ...base, windSpeed: 10 * MPH, windDirection: -Math.PI / 2 }, 600)
    expect(left.windage).toBeCloseTo(-right.windage, 9)
  })

  it('head and tail winds need no windage', async () => {
    const head = await solveAt({ ...base, windSpeed: 10 * MPH, windDirection: 0 }, 600)
    const tail = await solveAt({ ...base, windSpeed: 10 * MPH, windDirection: Math.PI }, 600)
    expect(Math.abs(head.windage)).toBeLessThan(1e-9)
    expect(Math.abs(tail.windage)).toBeLessThan(1e-9)
    expect(head.elevation).toBeGreaterThan(tail.elevation)
  })

  it('right-hand twist drifts right, so needs a left correction', async () => {
    const s = await solveAt({ ...base, twistRate: 8 * 0.0254, bulletLength: 1.35 * 0.0254 }, 1000)
    expect(s.windage).toBeLessThan(0)
  })

  it('has no spin drift when bullet length is not given', async () => {
    const s = await solveAt({ ...base, twistRate: 8 * 0.0254 }, 1000)
    expect(Math.abs(s.windage)).toBeLessThan(1e-9)
  })

  it('G1 and G7 give different answers for the same BC number', async () => {
    const g7 = await solveAt(base, 800)
    const g1 = await solveAt({ ...base, dragModel: 'G1' }, 800)
    expect(g1.elevation).not.toBeCloseTo(g7.elevation, 4)
  })

  it('estimates pressure from altitude: thinner air means less drop', async () => {
    const sea = await solveAt({ ...base, stationPressure: undefined, altitude: 0 }, 1000)
    const high = await solveAt({ ...base, stationPressure: undefined, altitude: 2000 }, 1000)
    expect(high.elevation).toBeLessThan(sea.elevation)
  })

  it('reports when the target is out of reach', async () => {
    await expect(solveAt({ ...base, muzzleVelocity: 300 }, 20000)).rejects.toThrow()
  })

  it("out of reach is a plain BallisticsError, not the library's own error", async () => {
    await expect(solveAt({ ...base, muzzleVelocity: 300 }, 20000)).rejects.toBeInstanceOf(BallisticsError)
  })
})
