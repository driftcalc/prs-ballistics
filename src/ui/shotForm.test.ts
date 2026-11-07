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
