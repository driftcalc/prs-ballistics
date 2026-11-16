import { describe, expect, it } from 'vitest'
import type { ReferenceCase } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { toFormValues } from '../ui/shotForm.ts'
import { combine, conditionsOf, guessedText, guessNote, rifleOf, stillGuessed, windOf } from './profiles.ts'
import { DATA_VERSION, emptyData, migrateLegacy, normalizeSettings, upgradeSaved, type AppData } from './store.ts'

describe('profiles', () => {
  it('splitting inputs and combining them again gives the same inputs', () => {
    const us = { ...DEFAULT_INPUTS, muzzleVelocityFps: 2810, temperatureF: 20, windClock: 9 }
    expect(combine(rifleOf(us), conditionsOf(us), windOf(us))).toEqual(us)
  })
})

describe('guessed values', () => {
  const r = { ...rifleOf(DEFAULT_INPUTS), bulletLengthIn: 1.35 } // spin drift on
  it("doesn't mention a guessed twist while spin drift is off (no bullet length)", () => {
    const noLength = { ...r, bulletLengthIn: undefined }
    expect(guessedText({ rifle: noLength, guessed: ['twistIn', 'sightHeightIn'] })).toBe('sight height 2 in')
    expect(guessNote({ rifle: noLength, guessed: ['twistIn'] })).toBe('')
  })

  it('changing a guessed value confirms it; the others stay guesses', () => {
    expect(stillGuessed(['twistIn', 'sightHeightIn'], r, { ...r, twistIn: 10 })).toEqual(['sightHeightIn'])
    expect(stillGuessed(['twistIn'], r, { ...r, twistIn: 10 })).toBeUndefined()
    expect(stillGuessed(undefined, r, { ...r, twistIn: 10 })).toBeUndefined()
    // Clearing the twist turns spin drift off, so there is nothing left to guess.
    expect(stillGuessed(['twistIn'], r, { ...r, twistIn: undefined })).toBeUndefined()
  })

  it('says which values are guesses in plain words', () => {
    expect(guessedText({ rifle: r, guessed: ['twistIn', 'sightHeightIn'] })).toBe('twist 1:8 and sight height 2 in')
    expect(guessedText({ rifle: r, guessed: [] })).toBe('')
    expect(guessedText({ rifle: r })).toBe('')
    expect(guessNote({ rifle: r, guessed: ['twistIn'] })).toBe('Twist 1:8 is a guess — check it in Rifles')
    expect(guessNote({ rifle: r, guessed: ['twistIn', 'sightHeightIn'] })).toBe('Twist 1:8 and sight height 2 in are guesses — check them in Rifles')
    expect(guessNote({ rifle: r })).toBe('')
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
    expect(up.settings).toEqual({ angleUnit: 'moa', theme: 'night', glove: false, leftHanded: false, holdMode: 'dial', cardWindsMph: [5, 10], rangeCard: { stepYd: 50, maxYd: 1000 } })
    expect(up.matches).toEqual([])
  })

  it('version 8 to 9: twist / sight height still exactly at the typical value are marked as guesses', () => {
    const v8 = { ...emptyData(), version: 8 } as unknown as AppData
    v8.profiles = [
      { id: 'a', name: 'Untouched', rifle: rifleOf(DEFAULT_INPUTS), updatedAt: '' },
      { id: 'b', name: 'Typed', rifle: { ...rifleOf(DEFAULT_INPUTS), twistIn: 10, sightHeightIn: 1.6 }, updatedAt: '' },
      { id: 'c', name: 'No twist', rifle: { ...rifleOf(DEFAULT_INPUTS), twistIn: undefined }, updatedAt: '' },
    ]
    const up = upgradeSaved(v8)
    expect(up.profiles.map((p) => p.guessed)).toEqual([['twistIn', 'sightHeightIn'], undefined, ['sightHeightIn']])
    // Nothing else about the rifles changes.
    expect(up.profiles.map(({ guessed, ...rest }) => rest)).toEqual(v8.profiles)
  })

  it('version 9 data keeps its guesses as saved (a confirmed 1:8 stays confirmed)', () => {
    const v9 = { ...emptyData(), version: 9 } as unknown as AppData
    v9.profiles = [{ id: 'a', name: 'Checked', rifle: rifleOf(DEFAULT_INPUTS), updatedAt: '' }]
    expect(upgradeSaved(v9).profiles[0].guessed).toBeUndefined()
  })

  it('range card: keeps step 25/50 and a max of 200–3000 yd in 50s, otherwise 50 yd to 1000 yd', () => {
    expect(normalizeSettings({ rangeCard: { stepYd: 25, maxYd: 400 } }).rangeCard).toEqual({ stepYd: 25, maxYd: 400 })
    expect(normalizeSettings({ rangeCard: { stepYd: 30, maxYd: 5000 } as never }).rangeCard).toEqual({ stepYd: 50, maxYd: 1000 })
    expect(normalizeSettings({ rangeCard: { stepYd: 50, maxYd: 425 } }).rangeCard).toEqual({ stepYd: 50, maxYd: 1000 })
    expect(normalizeSettings({}).rangeCard).toEqual({ stepYd: 50, maxYd: 1000 })
  })

  it('card wind speeds: keeps two whole speeds 1–60 mph, otherwise 5 and 10', () => {
    expect(normalizeSettings({ cardWindsMph: [4, 8] }).cardWindsMph).toEqual([4, 8])
    expect(normalizeSettings({ cardWindsMph: [0, 8] as never }).cardWindsMph).toEqual([5, 10])
    expect(normalizeSettings({ cardWindsMph: [5] as never }).cardWindsMph).toEqual([5, 10])
  })
})
