// Turns SI results into the text shown on screen.
import { metersToYards, mpsToFps, radiansToMil, radiansToMoa } from '../units/index.ts'

const fixed = (n: number, digits: number) => Math.abs(n).toFixed(digits)

/** e.g. "UP 5.4" — direction words make the sign impossible to misread. */
export function elevationText(rad: number, unit: 'mil' | 'moa'): string {
  const v = unit === 'mil' ? radiansToMil(rad) : radiansToMoa(rad)
  if (Number(fixed(v, 1)) === 0) return `0.0`
  return `${v > 0 ? 'UP' : 'DOWN'} ${fixed(v, 1)}`
}

/** e.g. "L 1.2" — which way to dial (or hold). */
export function windageText(rad: number, unit: 'mil' | 'moa'): string {
  const v = unit === 'mil' ? radiansToMil(rad) : radiansToMoa(rad)
  if (Number(fixed(v, 1)) === 0) return `0.0`
  return `${v > 0 ? 'R' : 'L'} ${fixed(v, 1)}`
}

export const velocityText = (mps: number) => `${Math.round(mpsToFps(mps))} fps`
export const timeText = (s: number) => `${s.toFixed(2)} s`
export const yardsText = (m: number) => `${Math.round(metersToYards(m))} yd`

/** Signed number with 2 decimals, e.g. "+0.04" / "-0.12". */
export const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
