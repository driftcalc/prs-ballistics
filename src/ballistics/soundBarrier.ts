// When is a hold less reliable because the bullet is near or below the speed of
// sound? No physics here: it only reads the Mach figures the engine (the
// library) already worked out, and sorts them with the owner's chosen limits.
//
// Drag models (G1/G7) are least accurate as a bullet slows through the speed of
// sound, so a centerfire hold there deserves a plain warning. Loads that leave
// the muzzle below Mach 1.2 (rimfire) spend their whole flight there, and their
// shooters work from real dope, so they get no warning at all (owner's choice).

/** Loads leaving the muzzle at least this fast get warnings (centerfire). */
export const WARN_LOADS_FROM_MACH = 1.2
/** At or below this the bullet is "nearing the speed of sound". */
export const NEAR_SOUND_MACH = 1.2
/** Below this the bullet is slower than sound. */
export const SOUND_MACH = 1.0

export type SoundZone = 'ok' | 'near' | 'below'

export function soundZone(mach: number, muzzleMach: number): SoundZone {
  if (!(muzzleMach >= WARN_LOADS_FROM_MACH)) return 'ok'
  if (mach < SOUND_MACH) return 'below'
  if (mach <= NEAR_SOUND_MACH) return 'near'
  return 'ok'
}

/** Short label for a card row or table divider, or '' when fine. */
export function soundLabel(zone: SoundZone): string {
  return zone === 'below' ? 'Below the speed of sound' : zone === 'near' ? 'Nearing the speed of sound' : ''
}

/** The full sentence for the Shoot screen, or '' when fine. */
export function soundNote(zone: SoundZone, mach: number): string {
  const m = `Mach ${mach.toFixed(2)}`
  if (zone === 'below') return `Below the speed of sound here (${m}) — beyond reliable range. Holds are much less reliable; confirm on steel.`
  if (zone === 'near') return `Nearing the speed of sound here (${m}) — holds are less certain. Confirm on steel.`
  return ''
}
