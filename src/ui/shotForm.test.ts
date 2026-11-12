import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { parseFormValues, toFormValues } from './shotForm.ts'

describe('weather boxes that are hidden', () => {
  it('keeps your station pressure while "Altitude" is chosen', () => {
    const values = toFormValues({ ...DEFAULT_INPUTS, atmosphereMode: 'altitude', stationPressureInHg: 25.4, altitudeFt: 5200 })
    const { inputs, errors } = parseFormValues(values, ['weather'])
    expect(errors).toEqual([])
    expect(inputs?.stationPressureInHg).toBe(25.4) // not reset to 29.92
    expect(inputs?.altitudeFt).toBe(5200)
  })

  it('keeps your altitude while "Station pressure" is chosen', () => {
    const values = toFormValues({ ...DEFAULT_INPUTS, atmosphereMode: 'pressure', stationPressureInHg: 25.4, altitudeFt: 5200 })
    expect(parseFormValues(values, ['weather']).inputs?.altitudeFt).toBe(5200)
  })

  it("doesn't complain about a hidden box that's blank or odd", () => {
    const values = { ...toFormValues({ ...DEFAULT_INPUTS, atmosphereMode: 'altitude', altitudeFt: 3000 }), stationPressureInHg: 'abc' }
    expect(parseFormValues(values, ['weather']).errors).toEqual([])
  })
})

describe('plain-English problems', () => {
  it('says what looks wrong, what is normal, and puts it under the right box', () => {
    const values = { ...toFormValues(DEFAULT_INPUTS), muzzleVelocityFps: '27000', bc: '' }
    const { inputs, errors, fieldErrors } = parseFormValues(values, ['rifle'])
    expect(inputs).toBeUndefined()
    expect(fieldErrors.muzzleVelocityFps).toBe(
      'Muzzle velocity 27000 fps looks wrong — rifle loads are usually 1,000–4,000 fps. Check the ammo box or your chronograph.',
    )
    expect(fieldErrors.bc).toMatch(/^Ballistic coefficient \(BC\) is missing\. Hint: /)
    expect(errors).toHaveLength(2)
  })

  it('a word instead of a number gets an example', () => {
    const values = { ...toFormValues(DEFAULT_INPUTS), zeroRangeYd: 'abc' }
    expect(parseFormValues(values, ['rifle']).fieldErrors.zeroRangeYd).toBe('Zero range must be a number, e.g. 100.')
  })
})
