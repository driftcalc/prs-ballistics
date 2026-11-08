// Works out a stage card: for every target, the elevation and the full-value
// wind holds (from the left and from the right) at the shooter's two card
// wind speeds. Only asks the ballistics engine; no formulas here.
import { getEngine } from '../ballistics/index.ts'
import type { CardRow, Match, Stage, StageCard } from '../data/match.ts'
import { combine, type Conditions, type RifleProfile } from '../data/profiles.ts'
import { toShotInput } from '../shotInputs.ts'
import { yardsToMeters } from '../units/index.ts'

const FROM_LEFT = 9
const FROM_RIGHT = 3

export async function computeCard(stage: Stage, profile: RifleProfile, conditions: Conditions, windsMph: number[], now = new Date()): Promise<StageCard> {
  const engine = await getEngine()
  const ranges = stage.targets.map((t) => yardsToMeters(t.rangeYd))
  const solve = (windSpeedMph: number, windClock: number) =>
    ranges.length ? engine.solve(toShotInput(combine(profile.rifle, conditions, { windSpeedMph, windClock })), ranges) : Promise.resolve([])

  // Elevation from a calm-air solve; wind holds from full-value wind each side.
  const calm = await solve(0, FROM_RIGHT)
  const winds = await Promise.all(windsMph.map(async (mph) => ({ mph, left: await solve(mph, FROM_LEFT), right: await solve(mph, FROM_RIGHT) })))

  const rows: CardRow[] = stage.targets.map((t, i) => ({
    name: t.name,
    rangeYd: t.rangeYd,
    elevationRad: calm[i].elevation,
    wind: winds.map((w) => ({ mph: w.mph, fromLeftRad: w.left[i].windage, fromRightRad: w.right[i].windage })),
  }))
  return {
    computedAt: now.toISOString(),
    profileName: profile.name,
    rifle: { ...profile.rifle },
    conditions: { ...conditions },
    windsMph: [...windsMph],
    rows,
  }
}

/** Redoes every card in a match (the "Update all cards" button). Returns a new match. */
export async function computeAllCards(match: Match, profile: RifleProfile, conditions: Conditions, windsMph: number[]): Promise<Match> {
  const now = new Date()
  const stages = await Promise.all(match.stages.map(async (s) => ({ ...s, card: await computeCard(s, profile, conditions, windsMph, now) })))
  return { ...match, stages }
}
