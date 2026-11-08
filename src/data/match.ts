// Matches: a list of stages, each with its targets and an optional shot order,
// plus the stage card (holds) worked out for it. Saved with everything else.
import type { StageTarget } from '../match/parse.ts'
import type { Conditions, RifleData } from './profiles.ts'

/** One row of a stage card. Angles in radians (SI); converted only for display. */
export interface CardRow {
  name: string
  rangeYd: number
  /** Up = positive. */
  elevationRad: number
  /** Right = positive, for wind FROM the left (9 o'clock) and FROM the right (3 o'clock), per card wind speed. */
  wind: { mph: number; fromLeftRad: number; fromRightRad: number }[]
}

/** Holds worked out for a stage, and exactly what they were worked out for. */
export interface StageCard {
  computedAt: string
  profileName: string
  rifle: RifleData
  conditions: Conditions
  windsMph: number[]
  rows: CardRow[]
}

export interface Stage {
  id: string
  name: string
  targets: StageTarget[]
  /** Target names in firing order; empty = not given. */
  order: string[]
  card?: StageCard
}

export interface Match {
  id: string
  name: string
  /** YYYY-MM-DD */
  date: string
  profileId: string
  stages: Stage[]
  createdAt: string
}

const same = (a: object, b: object) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}

/**
 * True when a card no longer matches the rifle, weather, wind speeds or
 * targets it should show. Cards are never redone silently; the Match screen
 * offers "Update all cards" instead.
 */
export function cardIsStale(stage: Stage, rifle: RifleData | undefined, conditions: Conditions, windsMph: number[]): boolean {
  const c = stage.card
  if (!c || !rifle) return true
  return (
    !same(c.rifle, rifle) ||
    !same(c.conditions, conditions) ||
    c.windsMph.join() !== windsMph.join() ||
    c.rows.map((r) => `${r.name} ${r.rangeYd}`).join() !== stage.targets.map((t) => `${t.name} ${t.rangeYd}`).join()
  )
}

/** Checks a match read from a backup file has the essentials; returns a reason if not. */
export function matchProblem(m: Partial<Match> | undefined): string | undefined {
  if (!m || typeof m !== 'object') return 'not a match'
  if (typeof m.id !== 'string' || typeof m.name !== 'string') return 'missing id or name'
  if (!Array.isArray(m.stages)) return 'missing stages'
  for (const s of m.stages) {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.targets) || !Array.isArray(s.order)) return 'a stage is damaged'
    if (s.targets.some((t) => typeof t?.name !== 'string' || typeof t?.rangeYd !== 'number')) return 'a target is damaged'
  }
  return undefined
}
