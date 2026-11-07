// The "plug" between the app and whatever ballistics library does the math.
// The UI only ever talks to this interface, never to js-ballistics directly,
// so the engine can be swapped later without touching the screens.
//
// Every number here is SI (metres, metres/second, kilograms, radians, kelvin,
// pascals). Converting to yards, fps, mil or MOA happens only in src/units/,
// right before display.

/** Shape of a ballistics engine. Inputs and outputs are filled in when the first feature is built. */
export interface BallisticsEngine {
  /** Human-readable name, e.g. for the About screen. */
  readonly name: string
}
