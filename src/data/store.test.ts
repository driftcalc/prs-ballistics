import { describe, expect, it } from 'vitest'
import type { ReferenceCase } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { toFormValues } from '../ui/shotForm.ts'
import { combine, conditionsOf, rifleOf, windOf } from './profiles.ts'
import { DATA_VERSION, emptyData, migrateLegacy, normalizeSettings, upgradeSaved, type AppData } from './store.ts'

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

describe('display settings from before version 4', () => {
  it('night on becomes the Night theme; night off becomes Auto', () => {
    expect(normalizeSettings({ angleUnit: 'mil', night: true } as never).theme).toBe('night')
    expect(normalizeSettings({ angleUnit: 'mil', night: false } as never).theme).toBe('auto')
  })

  it('keeps a theme that is already set, and fills in glove / left-handed', () => {
    expect(normalizeSettings({ theme: 'sun' })).toMatchObject({ theme: 'sun', glove: false, leftHanded: false, angleUnit: 'mil' })
  })

  it('ignores an unknown theme', () => {
    expect(normalizeSettings({ theme: 'camo' as never }).theme).toBe('auto')
  })
})

describe('upgrading saved data', () => {
  it('version 1 (app 0.2) is upgraded to the current version, gets an empty logbook and keeps everything else', () => {
    const v1 = { ...emptyData(), version: 1, log: undefined } as unknown as AppData
    v1.profiles = [{ id: 'x', name: 'Keep me', rifle: rifleOf(DEFAULT_INPUTS), updatedAt: '' }]
    // Version 1 had only night on/off.
    v1.settings = { angleUnit: 'moa', night: true } as unknown as AppData['settings']
    const up = upgradeSaved(v1)
    expect(up.version).toBe(DATA_VERSION)
    expect(up.log).toEqual([])
    expect(up.profiles[0].name).toBe('Keep me')
    expect(up.settings).toEqual({ angleUnit: 'moa', theme: 'night', glove: false, leftHanded: false, holdMode: 'dial', cardWindsMph: [5, 10] })
    expect(up.matches).toEqual([])
  })

  it('card wind speeds: keeps two whole speeds 1–60 mph, otherwise 5 and 10', () => {
    expect(normalizeSettings({ cardWindsMph: [4, 8] }).cardWindsMph).toEqual([4, 8])
    expect(normalizeSettings({ cardWindsMph: [0, 8] as never }).cardWindsMph).toEqual([5, 10])
    expect(normalizeSettings({ cardWindsMph: [5] as never }).cardWindsMph).toEqual([5, 10])
  })
})
