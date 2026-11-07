// Runs every saved Hornady / Applied Ballistics comparison in ./cases.
// A row more than TOLERANCE_MIL away fails the test, which stops publishing.
import { describe, expect, it } from 'vitest'
import { getEngine } from '../ballistics/index.ts'
import { compareCase, flaggedRows, TOLERANCE_MIL, validateCase } from './compare.ts'

const files = import.meta.glob('./cases/*.json', { eager: true, import: 'default' })
const fmt = (n: number | null) => (n === null ? '-' : n.toFixed(2))

describe(`reference cases (within ${TOLERANCE_MIL} mil)`, () => {
  if (Object.keys(files).length === 0) {
    it.todo('add comparisons exported from the Check accuracy page to src/accuracy/cases/')
  }

  for (const [path, data] of Object.entries(files)) {
    const c = validateCase(data, path)
    it(`${c.name} (${c.source})`, async () => {
      const rows = await compareCase(c, await getEngine())
      const problems = flaggedRows(rows).map(
        (r) =>
          `${r.rangeYd} yd: elevation ours ${fmt(r.ours.elevationMil)} vs ${fmt(r.theirs.elevationMil)} (diff ${fmt(r.elevationDiff)}), ` +
          `windage ours ${fmt(r.ours.windageMil)} vs ${fmt(r.theirs.windageMil)} (diff ${fmt(r.windageDiff)})`,
      )
      expect(problems).toEqual([])
    })
  }
})
