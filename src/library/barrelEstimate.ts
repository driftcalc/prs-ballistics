// Barrel-length velocity ESTIMATE.
//
// This is the ONE agreed exception to "never write ballistics formulas by hand"
// (see CLAUDE.md). It is a rule of thumb, not trajectory math: published
// velocity + (your barrel - test barrel) x fps-per-inch for the cartridge.
// It is always shown to the user as an estimate with a +/- range, and the
// logbook + truing assistant are there to correct it.
import type { Cartridge, FactoryLoad } from './ammo.ts'

interface PerInch {
  fpsPerInch: number
  /** How unsure the per-inch figure is (fps per inch, +/-). */
  uncertaintyPerInch: number
  source: string
}

export const FPS_PER_INCH: Record<Cartridge, PerInch> = {
  '6.5 Creedmoor': {
    fpsPerInch: 20,
    uncertaintyPerInch: 6,
    source:
      'Measured cut-down test 27″→16″: factory 120 gr lost 21.8 fps/in, a heavier handload 14–16 fps/in (rifleshooter.com, 2016).',
  },
  '.308 Win': {
    fpsPerInch: 23,
    uncertaintyPerInch: 4,
    source: 'Measured cut-down test 28″→16.5″: four loads lost 20.9–24.6 fps/in (rifleshooter.com, 2014).',
  },
  '6mm Creedmoor': {
    fpsPerInch: 25,
    uncertaintyPerInch: 8,
    source: 'No readable measured data found; general rule of thumb of about 25 fps per inch.',
  },
}

export const MIN_BARREL_IN = 16
export const MAX_BARREL_IN = 32
/** Rifle-to-rifle and lot-to-lot spread even at the same barrel length. */
const BASE_UNCERTAINTY_FPS = 25

export interface VelocityEstimate {
  fps: number
  /** Rounded +/- range in fps. */
  plusMinus: number
  /** False when no barrel length was given (published value used as-is). */
  adjusted: boolean
  /** The barrel length actually used (after keeping it within 16–32″). */
  barrelIn?: number
  clamped: boolean
}

const round5 = (n: number) => Math.round(n / 5) * 5

export function estimateVelocity(load: FactoryLoad, barrelIn?: number): VelocityEstimate {
  if (barrelIn === undefined || !Number.isFinite(barrelIn)) {
    return { fps: load.muzzleVelocityFps, plusMinus: BASE_UNCERTAINTY_FPS, adjusted: false, clamped: false }
  }
  const used = Math.min(MAX_BARREL_IN, Math.max(MIN_BARREL_IN, barrelIn))
  const per = FPS_PER_INCH[load.cartridge]
  const diff = used - load.testBarrelIn
  return {
    fps: Math.round(load.muzzleVelocityFps + diff * per.fpsPerInch),
    plusMinus: round5(BASE_UNCERTAINTY_FPS + Math.abs(diff) * per.uncertaintyPerInch),
    adjusted: diff !== 0,
    barrelIn: used,
    clamped: used !== barrelIn,
  }
}
