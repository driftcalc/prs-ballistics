// Turns SI results into the text shown on screen.
import { mpsToFps, radiansToMil, radiansToMoa } from '../units/index.ts'

const fixed = (n: number, digits: number) => Math.abs(n).toFixed(digits)

/**
 * Direction word and number separately, e.g. { dir: 'UP', value: '4.0' } or
 * { dir: 'L', value: '1.2' }. Direction words make the sign impossible to misread.
 */
export function holdParts(rad: number, unit: 'mil' | 'moa', kind: 'elevation' | 'windage'): { dir: string; value: string } {
  const v = unit === 'mil' ? radiansToMil(rad) : radiansToMoa(rad)
  const value = fixed(v, 1)
  if (Number(value) === 0) return { dir: '', value: '0.0' }
  const dir = kind === 'elevation' ? (v > 0 ? 'UP' : 'DN') : v > 0 ? 'R' : 'L'
  return { dir, value }
}

export const velocityText = (mps: number) => `${Math.round(mpsToFps(mps))} fps`
export const timeText = (s: number) => `${s.toFixed(2)} s`

/** Signed number with 2 decimals, e.g. "+0.04" / "-0.12". */
export const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Elevation direction word: Dial shows turret values (UP / DN), Hold shows reticle holds (OVER / UNDER). */
export function elevWord(dir: string, mode: 'dial' | 'hold'): string {
  if (mode === 'dial') return dir
  return dir === 'UP' ? 'OVER' : dir === 'DN' ? 'UNDER' : dir
}
