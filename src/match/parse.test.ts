import { describe, expect, it } from 'vitest'
import { parseOrder, parseTargets, targetsText } from './parse.ts'

describe('parseTargets', () => {
  it('reads the usual "T1 611, T2 639" form', () => {
    expect(parseTargets('T1 611, T2 639, T3 700')).toEqual({
      targets: [
        { name: 'T1', rangeYd: 611 },
        { name: 'T2', rangeYd: 639 },
        { name: 'T3', rangeYd: 700 },
      ],
      problems: [],
    })
  })

  it('forgives messy typing: no commas, colons, equals, lower case, yd suffix', () => {
    const { targets, problems } = parseTargets('  t1:611   T2=639yd,,t3 700 y ; plate 450')
    expect(problems).toEqual([])
    expect(targets.map((t) => `${t.name} ${t.rangeYd}`)).toEqual(['T1 611', 'T2 639', 'T3 700', 'PLATE 450'])
  })

  it('names plain distances T1, T2, T3', () => {
    expect(targetsText(parseTargets('611 639 700').targets)).toBe('T1 611, T2 639, T3 700')
  })

  it('auto names skip names already used', () => {
    expect(targetsText(parseTargets('T2 400, 500').targets)).toBe('T2 400, T3 500')
  })

  it('explains mistakes in plain English and keeps the good targets', () => {
    const { targets, problems } = parseTargets('T1 611, T2 639, T2 700, T4, T5 5000')
    expect(targetsText(targets)).toBe('T1 611, T2 639')
    expect(problems).toEqual(['T2 is listed twice.', 'T4 has no distance.', 'T5 at 5000 yd is out of range (25–3000 yd).'])
  })

  it('asks for something when empty', () => {
    expect(parseTargets('   ').problems).toHaveLength(1)
  })
})

describe('parseOrder', () => {
  const { targets } = parseTargets('T1 611, T2 639, T3 700')

  it('reads names and bare numbers, repeats allowed', () => {
    expect(parseOrder('T1, t3 2 -> T1', targets)).toEqual({ order: ['T1', 'T3', 'T2', 'T1'], problems: [] })
  })

  it('flags names that are not targets', () => {
    expect(parseOrder('T1 T9', targets)).toEqual({ order: ['T1'], problems: ["T9 isn't one of this stage's targets."] })
  })

  it('empty order is fine', () => {
    expect(parseOrder('', targets)).toEqual({ order: [], problems: [] })
  })
})
