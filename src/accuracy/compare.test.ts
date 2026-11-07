import { describe, expect, it } from 'vitest'
import { getEngine } from '../ballistics/index.ts'
import { DEFAULT_INPUTS } from '../shotInputs.ts'
import { compareCase, emptyRows, flaggedRows, parseMil, type ReferenceCase } from './compare.ts'

describe('parseMil', () => {
  it('reads plain and app-style numbers', () => {
    expect(parseMil('1.2')).toBe(1.2)
    expect(parseMil('-0.4')).toBe(-0.4)
    expect(parseMil('L 0.4')).toBe(-0.4)
    expect(parseMil('0.4L')).toBe(-0.4)
    expect(parseMil('R0.4')).toBe(0.4)
    expect(parseMil('U 5,3')).toBe(5.3)
    expect(parseMil('D 0.1')).toBe(-0.1)
    expect(parseMil('')).toBeNull()
    expect(parseMil('abc')).toBeNaN()
  })
})

describe('compareCase', () => {
  it('flags rows more than 0.1 mil away and passes rows within it', async () => {
    const engine = await getEngine()
    const base: ReferenceCase = { name: 't', source: 'Other', createdAt: '', inputs: DEFAULT_INPUTS, rows: emptyRows() }
    // First get our own answers, then pretend another app was slightly off.
    const ours = await compareCase(base, engine)
    const rows = ours.map((r, i) => ({
      ...r.theirs,
      elevationMil: r.ours.elevationMil + (i === 4 ? 0.15 : 0.05),
      windageMil: r.ours.windageMil,
    }))
    const result = await compareCase({ ...base, rows }, engine)
    expect(flaggedRows(result).map((r) => r.rangeYd)).toEqual([500])
    expect(result[0].elevationOk).toBe(true)
  })

  it('ignores blank cells', async () => {
    const engine = await getEngine()
    const result = await compareCase(
      { name: 't', source: 'Other', createdAt: '', inputs: DEFAULT_INPUTS, rows: emptyRows() },
      engine,
    )
    expect(flaggedRows(result)).toEqual([])
    expect(result[0].elevationOk).toBeNull()
  })
})
