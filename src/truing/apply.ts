// Applying (and undoing) a truing suggestion on a rifle. Only ever called from
// the Apply / Undo buttons after the owner taps them; never automatically.
import type { RifleProfile, TruingChange } from '../data/profiles.ts'
import type { Suggestion } from './truing.ts'

const label = (f: TruingChange['field']) => (f === 'muzzleVelocityFps' ? 'muzzle velocity' : 'BC')
export const truingValue = (f: TruingChange['field'], v: number) => (f === 'muzzleVelocityFps' ? `${v} fps` : v.toFixed(3))

/** Changes one value, records it for Revert, and notes the old value. */
export function applySuggestion(p: RifleProfile, s: Suggestion, now = new Date()): void {
  const change: TruingChange = {
    field: s.field,
    from: p.rifle[s.field],
    to: s.suggested,
    at: now.toISOString(),
    mvWasEstimated: p.factory?.mvEstimated,
  }
  p.rifle = { ...p.rifle, [s.field]: s.suggested }
  // A trued velocity replaces the factory-library estimate.
  if (s.field === 'muzzleVelocityFps' && p.factory) p.factory.mvEstimated = false
  const note = `Trued ${label(s.field)} ${truingValue(s.field, change.from)} → ${truingValue(s.field, change.to)} on ${now.toLocaleDateString()}.`
  p.notes = p.notes ? `${p.notes} ${note}` : note
  p.truingHistory = [...(p.truingHistory ?? []), change]
  p.updatedAt = now.toISOString()
}

/** The last truing change that can still be undone (the value hasn't been changed since). */
export function revertableChange(p: RifleProfile): TruingChange | undefined {
  const last = p.truingHistory?.at(-1)
  return last && p.rifle[last.field] === last.to ? last : undefined
}

/** Puts the last truing change back. Returns false if there's nothing to undo. */
export function revertLastChange(p: RifleProfile, now = new Date()): boolean {
  const last = revertableChange(p)
  if (!last) return false
  p.rifle = { ...p.rifle, [last.field]: last.from }
  if (last.field === 'muzzleVelocityFps' && p.factory && last.mvWasEstimated !== undefined) p.factory.mvEstimated = last.mvWasEstimated
  const note = `Undid truing: ${label(last.field)} back to ${truingValue(last.field, last.from)} on ${now.toLocaleDateString()}.`
  p.notes = p.notes ? `${p.notes} ${note}` : note
  p.truingHistory = p.truingHistory!.slice(0, -1)
  p.updatedAt = now.toISOString()
  return true
}
