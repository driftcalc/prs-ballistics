import { describe, expect, it } from 'vitest'
import { soundLabel, soundNote, soundZone } from './soundBarrier.ts'

describe('speed of sound warnings', () => {
  it('centerfire: fine above Mach 1.2, nearing from 1.2 down to 1.0, below under 1.0', () => {
    expect(soundZone(1.46, 2.33)).toBe('ok')
    expect(soundZone(1.2, 2.33)).toBe('near')
    expect(soundZone(1.0, 2.33)).toBe('near')
    expect(soundZone(0.99, 2.33)).toBe('below')
    expect(soundZone(0.7, 2.33)).toBe('below')
  })

  it('rimfire (leaving the muzzle below Mach 1.2) never warns', () => {
    expect(soundZone(0.72, 0.94)).toBe('ok') // subsonic .22 LR at 200 yd
    expect(soundZone(0.78, 1.12)).toBe('ok') // high-velocity .22 LR at 200 yd
  })

  it('says it in plain words', () => {
    expect(soundLabel('ok')).toBe('')
    expect(soundNote('ok', 1.5)).toBe('')
    expect(soundNote('below', 0.7)).toMatch(/^Below the speed of sound here \(Mach 0\.70\)/)
    expect(soundNote('near', 1.1)).toMatch(/^Nearing the speed of sound here \(Mach 1\.10\)/)
  })
})
