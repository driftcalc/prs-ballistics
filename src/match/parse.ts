// Turns what the shooter types for a stage into targets and a shot order.
// Forgiving on purpose: "T1 611, T2 639", "T1:611 T2=639", "t1 611yd" and
// plain "611 639 700" all work. Mistakes come back as plain-English problems.
import { MAX_RANGE_YD, MIN_RANGE_YD } from '../data/shootControls.ts'

export interface StageTarget {
  /** Upper-case name, e.g. "T1". */
  name: string
  rangeYd: number
}

export interface ParsedTargets {
  targets: StageTarget[]
  problems: string[]
}

export interface ParsedOrder {
  /** Target names in firing order (may repeat). */
  order: string[]
  problems: string[]
}

/** Splits on commas, semicolons, spaces, colons, equals signs and arrows. */
function tokens(text: string): string[] {
  return text
    .split(/[\s,;:=>→]+|-+>/)
    .map((t) => t.trim())
    .filter((t) => t && !/^(y|yds?|yards?)$/i.test(t)) // a unit typed after a space ("700 yd")
}

/** "611", "611yd", "611y" -> 611; anything else -> undefined. */
function asRange(token: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)(?:yds?|y)?$/i.exec(token)
  return m ? Math.round(Number(m[1])) : undefined
}

export function parseTargets(text: string): ParsedTargets {
  const targets: StageTarget[] = []
  const problems: string[] = []
  const toks = tokens(text)
  const used = new Set<string>()
  const autoName = () => {
    let n = targets.length + 1
    while (used.has(`T${n}`)) n++
    return `T${n}`
  }

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i]
    let name: string
    let range = asRange(tok)
    if (range === undefined) {
      name = tok.toUpperCase()
      range = i + 1 < toks.length ? asRange(toks[i + 1]) : undefined
      if (range === undefined) {
        problems.push(`${name} has no distance.`)
        continue
      }
      i++ // the distance belonged to this name
    } else {
      name = autoName()
    }
    if (used.has(name)) {
      problems.push(`${name} is listed twice.`)
      continue
    }
    if (range < MIN_RANGE_YD || range > MAX_RANGE_YD) {
      problems.push(`${name} at ${range} yd is out of range (${MIN_RANGE_YD}–${MAX_RANGE_YD} yd).`)
      continue
    }
    used.add(name)
    targets.push({ name, rangeYd: range })
  }
  if (!toks.length) problems.push('Type at least one target, e.g. "T1 611, T2 639".')
  return { targets, problems }
}

/**
 * Optional firing order, e.g. "T1, T3, T2, T1". A bare number means that
 * target ("3" -> T3) when there is one by that name.
 */
export function parseOrder(text: string, targets: StageTarget[]): ParsedOrder {
  const names = new Set(targets.map((t) => t.name))
  const order: string[] = []
  const problems: string[] = []
  for (const tok of tokens(text)) {
    const upper = tok.toUpperCase()
    const name = names.has(upper) ? upper : /^\d+$/.test(tok) && names.has(`T${tok}`) ? `T${tok}` : undefined
    if (name) order.push(name)
    else problems.push(`${upper} isn't one of this stage's targets.`)
  }
  return { order, problems }
}

/** Writes targets back as text, e.g. "T1 611, T2 639". */
export const targetsText = (targets: StageTarget[]) => targets.map((t) => `${t.name} ${t.rangeYd}`).join(', ')
