import { describe, expect, it } from 'vitest'
import type { ReferenceCase } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { toFormValues } from '../ui/shotForm.ts'
import { combine, conditionsOf, rifleOf, windOf } from './profiles.ts'
import { DATA_VERSION, emptyData, migrateLegacy, upgradeSaved, type AppData } from './store.ts'

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

describe('upgrading saved data', () => {
  it('version 1 (app 0.2) is upgraded to the current version, gets an empty logbook and keeps everything else', () => {
    const v1 = { ...emptyData(), version: 1, log: undefined } as unknown as AppData
    v1.profiles = [{ id: 'x', name: 'Keep me', rifle: rifleOf(DEFAULT_INPUTS), updatedAt: '' }]
    v1.settings = { angleUnit: 'moa', night: true }
    const up = upgradeSaved(v1)
    expect(up.version).toBe(DATA_VERSION)
    expect(up.log).toEqual([])
    expect(up.profiles[0].name).toBe('Keep me')
    expect(up.settings).toEqual({ angleUnit: 'moa', night: true })
  })
})
