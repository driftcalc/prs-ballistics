import { describe, expect, it } from 'vitest'
import type { ReferenceCase } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { toFormValues } from '../ui/shotForm.ts'
import { combine, conditionsOf, rifleOf, windOf } from './profiles.ts'
import { emptyData, migrateLegacy } from './store.ts'

describe('profiles', () => {
  it('splitting inputs and combining them again gives the same inputs', () => {
    const us = { ...DEFAULT_INPUTS, muzzleVelocityFps: 2810, temperatureF: 20, windClock: 9 }
    expect(combine(rifleOf(us), conditionsOf(us), windOf(us))).toEqual(us)
  })
})

describe('moving data from version 0.1', () => {
  it('turns the old Calculator inputs into a rifle and keeps conditions, wind and range', () => {
    const old = toFormValues({ ...DEFAULT_INPUTS, muzzleVelocityFps: 2650, temperatureF: 40, windSpeedMph: 7, windClock: 9 })
    const d = migrateLegacy(old, '750', undefined)
    expect(d.profiles).toHaveLength(1)
    expect(d.profiles[0].name).toBe('My rifle')
    expect(d.profiles[0].rifle.muzzleVelocityFps).toBe(2650)
    expect(d.conditions.temperatureF).toBe(40)
    expect(d.shoot).toMatchObject({ profileId: d.profiles[0].id, rangeYd: 750, windSpeedMph: 7, windClock: 9 })
  })

  it('keeps existing accuracy comparisons', () => {
    const cases: Record<string, ReferenceCase> = {
      abc: { name: 'x', source: 'Hornady', createdAt: '', inputs: DEFAULT_INPUTS, rows: [] },
    }
    expect(migrateLegacy(undefined, undefined, { ...cases }).comparisons).toEqual(cases)
  })

  it('starts empty when there was nothing saved', () => {
    expect(migrateLegacy()).toEqual({ ...emptyData() })
  })
})
