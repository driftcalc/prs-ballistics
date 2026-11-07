// The "plug" between the app and whatever ballistics library does the math.
// The UI only ever talks to this interface, never to js-ballistics directly,
// so the engine can be swapped later without touching the screens.
//
// Every number here is SI (metres, metres/second, kilograms, radians, kelvin,
// pascals). Converting to yards, fps, mil or MOA happens only in src/units/,
// right before display.

export type DragModelName = 'G1' | 'G7'

/** Everything needed to calculate a shot. All values SI. */
export interface ShotInput {
  /** Muzzle velocity, m/s. */
  muzzleVelocity: number
  ballisticCoefficient: number
  dragModel: DragModelName
  /** Bullet mass, kg. */
  bulletMass: number
  /** Bullet diameter, m. Needed (with length and twist) for spin drift. */
  bulletDiameter?: number
  /** Bullet length, m. Leave out to skip spin drift. */
  bulletLength?: number
  /** Height of the scope centre above the bore, m. */
  sightHeight: number
  /** Distance the rifle is zeroed at, m. */
  zeroRange: number
  /** Barrel twist, m per turn. Positive = right-hand twist, negative = left-hand. */
  twistRate?: number
  /** Air temperature, K. */
  temperature: number
  /** Station (actual, not sea-level) pressure, Pa. If left out it is estimated from altitude. */
  stationPressure?: number
  /** Altitude above sea level, m. */
  altitude?: number
  /** Relative humidity, 0 to 1. */
  humidity: number
  /** Wind speed, m/s. */
  windSpeed: number
  /**
   * Direction the wind blows FROM, in radians, measured clockwise from straight
   * down-range (12 o'clock). So 3 o'clock (from the right) = pi/2.
   */
  windDirection: number
}

/** The answer at one distance. All values SI. */
export interface RangeSolution {
  /** Distance to target, m. */
  range: number
  /** Scope correction up/down, radians. Positive = dial UP. */
  elevation: number
  /** Scope correction left/right, radians. Positive = dial RIGHT. */
  windage: number
  /** Remaining bullet velocity, m/s. */
  velocity: number
  /** Time of flight, s. */
  timeOfFlight: number
}

export interface BallisticsEngine {
  /** Human-readable name, e.g. for the About screen. */
  readonly name: string
  /** Calculate the solution at each requested distance (m). */
  solve(input: ShotInput, ranges: number[]): Promise<RangeSolution[]>
}

/** Thrown when the input can't be calculated (e.g. target beyond the bullet's reach). */
export class BallisticsError extends Error {}
