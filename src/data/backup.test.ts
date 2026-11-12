import { describe, expect, it } from 'vitest'
import { emptyRows } from '../accuracy/compare.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import {
  ImportError,
  mergeImport,
  parseBackupJson,
  parseCsv,
  parseRiflesCsv,
  replaceImport,
  toBackupJson,
  toRiflesCsv,
} from './backup.ts'
import { DEFAULT_RIFLE, type RifleProfile } from './profiles.ts'
import { emptyData, type AppData } from './store.ts'

const rifle = (name: string, mv = 2700, id = name): RifleProfile => ({
  id,
  name,
  rifle: { ...DEFAULT_RIFLE, muzzleVelocityFps: mv },
  updatedAt: '2026-11-07T00:00:00.000Z',
})

function sampleData(): AppData {
  const d = emptyData()
  d.profiles = [rifle('6.5 CM, "match"', 2710, 'a'), rifle('22 LR', 1070, 'b')]
  d.profiles[1].rifle = { ...d.profiles[1].rifle, dragModel: 'G1', bc: 0.13, bulletLengthIn: 0.6, twistIn: undefined }
  d.profiles[0].notes = 'Barrel #2, new brass'
  d.profiles[0].factory = { loadId: 'hornady-65cm-140-eldm', barrelIn: 22, mvEstimated: true }
  d.profiles[0].truingHistory = [{ field: 'muzzleVelocityFps', from: 2680, to: 2710, at: '2026-11-10T09:00:00.000Z', mvWasEstimated: true }]
  d.conditions.temperatureF = 33
  d.shoot = { ...d.shoot, profileId: 'b', rangeYd: 450, windClock: 10 }
  d.settings = { angleUnit: 'moa', theme: 'night', glove: true, leftHanded: true, holdMode: 'hold', cardWindsMph: [4, 8], rangeCard: { stepYd: 25, maxYd: 650 } }
  d.matches = [
    {
      id: 'm1',
      name: 'Club "PRS" match',
      date: '2026-11-14',
      profileId: 'a',
      createdAt: '2026-11-08T10:00:00.000Z',
      stages: [
        {
          id: 's1',
          name: 'Stage 1',
          targets: [
            { name: 'T1', rangeYd: 611 },
            { name: 'T2', rangeYd: 639 },
          ],
          order: ['T1', 'T2', 'T1'],
          card: {
            computedAt: '2026-11-08T10:01:00.000Z',
            profileName: d.profiles[0].name,
            rifle: d.profiles[0].rifle,
            conditions: d.conditions,
            windsMph: [4, 8],
            rows: [{ name: 'T1', rangeYd: 611, elevationRad: 0.004, wind: [{ mph: 4, fromLeftRad: -0.0005, fromRightRad: 0.0004 }] }],
          },
        },
        { id: 's2', name: 'Stage 2', targets: [{ name: 'T1', rangeYd: 400 }], order: [] },
      ],
    },
  ]
  d.comparisons = { c1: { name: 'Test', source: 'Hornady', createdAt: '', inputs: DEFAULT_INPUTS, rows: emptyRows() } }
  d.log = [
    {
      id: 'l1',
      profileId: 'a',
      profileName: d.profiles[0].name,
      rifle: d.profiles[0].rifle,
      createdAt: '2026-11-07T10:00:00.000Z',
      rangeYd: 700,
      conditions: d.conditions,
      wind: { windSpeedMph: 6, windClock: 2 },
      actualElevationMil: 5.3,
      actualWindageMil: -0.4,
      confirmed: true,
      notes: 'first round hit, "steel" plate',
      predicted: { elevationMil: 5.1, windageMil: -0.45, velocityFps: 1700, timeOfFlightS: 1.0 },
    },
  ]
  return d
}

describe('JSON backup', () => {
  it('restores exactly what was exported', () => {
    const d = sampleData()
    const back = parseBackupJson(toBackupJson(d))
    expect(back.warnings).toEqual([])
    expect(replaceImport(emptyData(), back)).toEqual(d)
  })

  it('still imports a backup made by version 0.2 (no logbook yet)', () => {
    const old = JSON.parse(toBackupJson(sampleData()))
    old.format = 1
    delete old.data.log
    const back = parseBackupJson(JSON.stringify(old))
    expect(back.warnings).toEqual([])
    expect(back.profiles).toHaveLength(2)
    expect(back.full?.log).toEqual([])
  })

  it('"Add" with a backup adds new log entries without duplicating existing ones', () => {
    const current = sampleData()
    const next = mergeImport(current, parseBackupJson(toBackupJson(sampleData())))
    expect(next.log.map((e) => e.id)).toEqual(['l1'])
  })

  it('still imports a backup made before matches existed (data version 5)', () => {
    const old = JSON.parse(toBackupJson(sampleData()))
    old.format = 5
    delete old.data.matches
    delete old.data.settings.cardWindsMph
    const back = parseBackupJson(JSON.stringify(old))
    expect(back.warnings).toEqual([])
    expect(back.full?.matches).toEqual([])
    expect(back.full?.settings.cardWindsMph).toEqual([5, 10])
  })

  it('"Add" with a backup adds new matches without duplicating existing ones', () => {
    const current = sampleData()
    current.matches = []
    const once = mergeImport(current, parseBackupJson(toBackupJson(sampleData())))
    const twice = mergeImport(once, parseBackupJson(toBackupJson(sampleData())))
    expect(twice.matches.map((m) => m.id)).toEqual(['m1'])
  })

  it('skips a damaged match and says so', () => {
    const file = JSON.parse(toBackupJson(sampleData()))
    file.data.matches.push({ id: 'bad', name: 'x', stages: [{ id: 's', targets: 'oops', order: [] }] })
    const back = parseBackupJson(JSON.stringify(file))
    expect(back.warnings).toEqual(['Skipped a match: a stage is damaged.'])
    expect(back.matches.map((m) => m.id)).toEqual(['m1'])
  })

  it('rejects files that are not a backup', () => {
    expect(() => parseBackupJson('not json')).toThrow(ImportError)
    expect(() => parseBackupJson('{"hello":1}')).toThrow(/isn't a Spin Drift backup/)
    expect(() => parseBackupJson('{"app":"prs-ballistics","format":99,"data":{}}')).toThrow(/newer version/)
  })

  it('skips a broken rifle but keeps the rest', () => {
    const d = sampleData()
    ;(d.profiles[0].rifle as { muzzleVelocityFps: unknown }).muzzleVelocityFps = 'fast'
    const back = parseBackupJson(toBackupJson(d))
    expect(back.profiles.map((p) => p.name)).toEqual(['22 LR'])
    expect(back.warnings[0]).toMatch(/Skipped rifle "6.5 CM/)
  })
})

describe('rifles CSV', () => {
  it('round-trips rifles, including commas and quotes in names', () => {
    const d = sampleData()
    const back = parseRiflesCsv(toRiflesCsv(d.profiles))
    expect(back.warnings).toEqual([])
    expect(back.profiles.map((p) => [p.name, p.notes, p.rifle])).toEqual(d.profiles.map((p) => [p.name, p.notes, p.rifle]))
  })

  it('reads a hand-made sheet with only some columns', () => {
    const csv = 'Name,Muzzle velocity (fps),BC,Bullet weight (gr),Sight height (in),Zero range (yd)\n308 Win,2650,0.243,175,1.75,100\n'
    const back = parseRiflesCsv(csv)
    expect(back.profiles[0].name).toBe('308 Win')
    expect(back.profiles[0].rifle).toMatchObject({ muzzleVelocityFps: 2650, dragModel: 'G7', twistDirection: 'right' })
  })

  it('skips bad rows and says why', () => {
    const csv = 'Name,Muzzle velocity (fps),BC,Bullet weight (gr),Sight height (in),Zero range (yd),BC type (G1/G7)\nGood,2650,0.243,175,1.75,100,G7\nBad,,0.2,150,2,100,G7\n'
    const back = parseRiflesCsv(csv)
    expect(back.profiles.map((p) => p.name)).toEqual(['Good'])
    expect(back.warnings[0]).toMatch(/row 3 \("Bad"\).*Muzzle velocity is missing/)
  })

  it('rejects a CSV that is not a rifles file', () => {
    expect(() => parseRiflesCsv('Date,Amount\n1,2\n')).toThrow(/doesn't look like a rifles file/)
  })

  it('handles Excel quirks: BOM, Windows line endings, quoted line breaks', () => {
    expect(parseCsv('﻿a,b\r\n"x\ny","z ""q"""\r\n')).toEqual([
      ['a', 'b'],
      ['x\ny', 'z "q"'],
    ])
  })
})

describe('applying an import', () => {
  it('"Add" keeps existing data and updates rifles with the same name', () => {
    const current = sampleData()
    const incoming = parseRiflesCsv(toRiflesCsv([rifle('22 lr', 1100), rifle('New one', 3000)]))
    const next = mergeImport(current, incoming)
    expect(next.profiles.map((p) => p.name)).toEqual(['6.5 CM, "match"', '22 LR', 'New one'])
    expect(next.profiles[1].rifle.muzzleVelocityFps).toBe(1100)
    expect(next.profiles[1].id).toBe('b') // still the rifle the Shoot screen points at
    expect(next.comparisons).toEqual(current.comparisons)
    expect(next.settings).toEqual(current.settings)
  })

  it('"Replace" with a rifles CSV swaps the rifles only', () => {
    const current = sampleData()
    const next = replaceImport(current, parseRiflesCsv(toRiflesCsv([rifle('Only', 2800)])))
    expect(next.profiles.map((p) => p.name)).toEqual(['Only'])
    expect(next.shoot.profileId).toBe(next.profiles[0].id)
    expect(next.comparisons).toEqual(current.comparisons)
  })

  it('does not change the current data object', () => {
    const current = sampleData()
    const before = structuredClone(current)
    mergeImport(current, parseRiflesCsv(toRiflesCsv([rifle('X', 2000)])))
    expect(current).toEqual(before)
  })
})
