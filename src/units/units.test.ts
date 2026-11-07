import { describe, expect, it } from 'vitest'
import * as u from './index.ts'

describe('unit conversions', () => {
  it('converts distances', () => {
    expect(u.yardsToMeters(1)).toBe(0.9144)
    expect(u.feetToMeters(1)).toBe(0.3048)
    expect(u.inchesToMeters(1)).toBe(0.0254)
    expect(u.metersToYards(u.yardsToMeters(1000))).toBeCloseTo(1000, 9)
  })

  it('converts speeds', () => {
    expect(u.fpsToMps(1000)).toBeCloseTo(304.8, 9)
    expect(u.mphToMps(10)).toBeCloseTo(4.4704, 9)
    expect(u.mpsToFps(u.fpsToMps(2700))).toBeCloseTo(2700, 9)
  })

  it('converts bullet weight', () => {
    expect(u.grainsToKg(7000)).toBeCloseTo(0.45359237, 9) // 7000 gr = 1 lb
  })

  it('converts temperature', () => {
    expect(u.fahrenheitToKelvin(32)).toBeCloseTo(273.15, 9)
    expect(u.fahrenheitToKelvin(59)).toBeCloseTo(288.15, 9)
    expect(u.kelvinToFahrenheit(373.15)).toBeCloseTo(212, 9)
  })

  it('converts pressure', () => {
    expect(u.inHgToPa(29.92)).toBeCloseTo(101320.8, 0)
  })

  it('converts angles', () => {
    expect(u.radiansToMil(0.001)).toBeCloseTo(1, 12)
    expect(u.radiansToMoa(u.milToRadians(1))).toBeCloseTo(3.43775, 5)
  })

  it('converts wind clock positions', () => {
    expect(u.clockToRadians(12)).toBe(0)
    expect(u.clockToRadians(3)).toBeCloseTo(Math.PI / 2, 12)
    expect(u.clockToRadians(9)).toBeCloseTo((3 * Math.PI) / 2, 12)
  })
})
