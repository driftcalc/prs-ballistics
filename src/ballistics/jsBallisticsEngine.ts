// Adapter: connects js-ballistics to the BallisticsEngine interface.
// This is the ONLY file in the app allowed to import 'js-ballistics'.
// It only translates units and conventions; all the physics is the library's.

import {
  Ammo,
  Atmo,
  Calculator,
  DragModel,
  DragTables,
  Shot,
  UNew,
  Unit,
  Weapon,
  Wind,
} from 'js-ballistics'
import { BallisticsError, type BallisticsEngine, type RangeSolution, type ShotInput } from './engine.ts'

// Ranges closer than this to the requested one count as "reached".
const RANGE_MATCH_M = 0.01

function buildShot(input: ShotInput): Shot {
  const dm = new DragModel({
    bc: input.ballisticCoefficient,
    dragTable: input.dragModel === 'G1' ? DragTables.G1 : DragTables.G7,
    weight: UNew.Kilogram(input.bulletMass),
    diameter: UNew.Meter(input.bulletDiameter ?? 0),
    length: UNew.Meter(input.bulletLength ?? 0),
  })
  const ammo = new Ammo({ dm, mv: UNew.MPS(input.muzzleVelocity) })
  const weapon = new Weapon({
    sightHeight: UNew.Meter(input.sightHeight),
    twist: UNew.Meter(input.twistRate ?? 0),
  })
  const atmo = new Atmo({
    altitude: UNew.Meter(input.altitude ?? 0),
    // Library has no pascal unit; hPa = Pa / 100. Undefined = standard pressure at altitude.
    pressure: input.stationPressure === undefined ? undefined : UNew.hPa(input.stationPressure / 100),
    temperature: UNew.Kelvin(input.temperature),
    humidity: input.humidity,
  })
  // Library wind angle: 0 = from behind the shooter, 90 deg = from the left.
  // Ours: 0 = from straight ahead, clockwise. The two differ by half a turn.
  const winds =
    input.windSpeed > 0
      ? [new Wind({ velocity: UNew.MPS(input.windSpeed), directionFrom: UNew.Radian(input.windDirection - Math.PI) })]
      : []
  return new Shot({ weapon, ammo, atmo, winds })
}

export function createJsBallisticsEngine(): BallisticsEngine {
  const calc = new Calculator()

  return {
    name: 'js-ballistics',

    async solve(input: ShotInput, ranges: number[]): Promise<RangeSolution[]> {
      const shot = buildShot(input)
      try {
        await calc.setWeaponZero(shot, UNew.Meter(input.zeroRange))
      } catch (e) {
        throw new BallisticsError(`Could not find a zero at that zero range (${(e as Error).message})`)
      }

      const results: RangeSolution[] = []
      for (const range of ranges) {
        // One run per range so the last sample lands exactly on the target distance.
        const hit = await calc.fire({ shot, trajectoryRange: UNew.Meter(range), trajectoryStep: UNew.Meter(range) })
        const point = hit.samples.at(-1)
        if (!point || Math.abs(point.distance.In(Unit.Meter) - range) > RANGE_MATCH_M) {
          throw new BallisticsError('The bullet does not reach that distance with these inputs.')
        }
        results.push({
          range,
          // Library angles say where the bullet lands; the scope correction is the opposite.
          elevation: -point.dropAngle.In(Unit.Radian),
          windage: -point.windageAngle.In(Unit.Radian),
          velocity: point.velocity.In(Unit.MPS),
          timeOfFlight: point.time,
        })
      }
      return results
    },
  }
}
