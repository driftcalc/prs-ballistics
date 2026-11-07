import { describe, expect, it } from 'vitest'
import { rotateClock, stepRange, stepWindSpeed } from './shootControls.ts'

describe('range stepper', () => {
  it('moves by the chosen step', () => {
    expect(stepRange(600, 25, 1)).toBe(625)
    expect(stepRange(600, 25, -1)).toBe(575)
    expect(stepRange(600, 100, 1)).toBe(700)
  })

  it('lands on whole steps from an odd range', () => {
    expect(stepRange(637, 25, 1)).toBe(650)
    expect(stepRange(637, 25, -1)).toBe(625)
  })

  it('stays within 25 to 3000 yd', () => {
    expect(stepRange(25, 25, -1)).toBe(25)
    expect(stepRange(50, 100, -1)).toBe(25)
    expect(stepRange(3000, 100, 1)).toBe(3000)
  })
})

describe('wind controls', () => {
  it('changes speed by 1 mph and never below 0', () => {
    expect(stepWindSpeed(10, 1)).toBe(11)
    expect(stepWindSpeed(0, -1)).toBe(0)
  })

  it('turns the clock and wraps around', () => {
    expect(rotateClock(3, 1)).toBe(4)
    expect(rotateClock(12, 1)).toBe(1)
    expect(rotateClock(1, -1)).toBe(12)
    expect(rotateClock(9, -1)).toBe(8)
  })
})
