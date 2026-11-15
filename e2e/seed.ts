// Saved data the field tests start from: two rifles, a match with stages,
// a few logged shots (enough for the truing flow), backup tip dismissed.
const rifle = {
  muzzleVelocityFps: 2700,
  bc: 0.3,
  dragModel: 'G7',
  bulletWeightGr: 140,
  bulletDiameterIn: 0.264,
  bulletLengthIn: 1.35,
  sightHeightIn: 2,
  zeroRangeYd: 100,
  twistIn: 8,
  twistDirection: 'right',
}
const conditions = { temperatureF: 59, atmosphereMode: 'pressure', stationPressureInHg: 29.92, altitudeFt: 0, humidityPct: 0 }
const calm = { windSpeedMph: 0, windClock: 3 }

// Holds as if the rifle really shot ~2620 fps (predictions are the app's at 2700 fps).
const shots: [number, number, number][] = [
  [300, 1.18, 1.3],
  [500, 2.94, 3.2],
  [700, 5.1, 5.5],
  [900, 7.73, 8.3],
  [1000, 9.27, 10.0],
]

export type Theme = 'sun' | 'dark' | 'night'

export function seedData(o: { theme: Theme; glove: boolean; leftHanded: boolean; rifles?: boolean }) {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  return {
    version: 8,
    profiles:
      o.rifles === false
        ? []
        : [
            { id: 'r1', name: '6.5 CM', rifle, updatedAt: now },
            { id: 'r2', name: '22 LR trainer', rifle: { ...rifle, muzzleVelocityFps: 1070, bc: 0.13, dragModel: 'G1', bulletWeightGr: 40, bulletDiameterIn: 0.224, bulletLengthIn: undefined, zeroRangeYd: 50 }, updatedAt: now },
          ],
    conditions,
    shoot: { profileId: o.rifles === false ? undefined : 'r1', rangeYd: 650, rangeStepYd: 25, windSpeedMph: 10, windClock: 9 },
    settings: {
      angleUnit: 'mil',
      theme: o.theme,
      glove: o.glove,
      leftHanded: o.leftHanded,
      holdMode: 'dial',
      cardWindsMph: [5, 10],
      rangeCard: { stepYd: 50, maxYd: 1000 },
      lastBackupAt: now,
      installTipDismissed: true,
    },
    comparisons: {},
    log:
      o.rifles === false
        ? []
        : shots.map(([rangeYd, predicted, actual], i) => ({
            id: `l${i + 1}`,
            profileId: 'r1',
            profileName: '6.5 CM',
            rifle,
            createdAt: now,
            rangeYd,
            conditions,
            wind: calm,
            actualElevationMil: actual,
            actualWindageMil: 0,
            confirmed: true,
            notes: i === 0 ? 'First round hit' : undefined,
            predicted: { elevationMil: predicted, windageMil: 0, velocityFps: 2000, timeOfFlightS: 1 },
          })),
    matches:
      o.rifles === false
        ? []
        : [
            {
              id: 'm1',
              name: 'Club PRS match',
              date: today,
              profileId: 'r1',
              createdAt: now,
              stages: [
                { id: 's1', name: 'Stage 1 · Barricade', targets: [{ name: 'T1', rangeYd: 611 }, { name: 'T2', rangeYd: 639 }, { name: 'T3', rangeYd: 700 }], order: ['T1', 'T3', 'T2', 'T1'] },
                { id: 's2', name: 'Stage 2', targets: [{ name: 'T1', rangeYd: 425 }, { name: 'PLATE', rangeYd: 1012 }], order: [] },
              ],
            },
          ],
  }
}
