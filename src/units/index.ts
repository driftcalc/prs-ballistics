// Conversions between the US units shown on screen and the SI units used
// everywhere inside the app. Screens convert at the edges only:
// typed value -> SI on the way in, SI -> display value on the way out.
// Factors below are exact international definitions.

const M_PER_YARD = 0.9144
const M_PER_FOOT = 0.3048
const M_PER_INCH = 0.0254
const KG_PER_GRAIN = 0.00006479891
const MPS_PER_MPH = 0.44704
const PA_PER_INHG = 3386.389
const RAD_PER_MIL = 0.001 // milliradian, as used by Hornady and AB
const RAD_PER_MOA = Math.PI / 10800 // 1/60 of a degree

export const yardsToMeters = (yd: number) => yd * M_PER_YARD
export const metersToYards = (m: number) => m / M_PER_YARD

export const feetToMeters = (ft: number) => ft * M_PER_FOOT
export const metersToFeet = (m: number) => m / M_PER_FOOT

export const inchesToMeters = (inch: number) => inch * M_PER_INCH
export const metersToInches = (m: number) => m / M_PER_INCH

export const fpsToMps = (fps: number) => fps * M_PER_FOOT
export const mpsToFps = (mps: number) => mps / M_PER_FOOT

export const mphToMps = (mph: number) => mph * MPS_PER_MPH
export const mpsToMph = (mps: number) => mps / MPS_PER_MPH

export const grainsToKg = (gr: number) => gr * KG_PER_GRAIN
export const kgToGrains = (kg: number) => kg / KG_PER_GRAIN

export const fahrenheitToKelvin = (f: number) => ((f - 32) * 5) / 9 + 273.15
export const kelvinToFahrenheit = (k: number) => ((k - 273.15) * 9) / 5 + 32

export const inHgToPa = (inHg: number) => inHg * PA_PER_INHG
export const paToInHg = (pa: number) => pa / PA_PER_INHG

export const radiansToMil = (rad: number) => rad / RAD_PER_MIL
export const milToRadians = (mil: number) => mil * RAD_PER_MIL
export const radiansToMoa = (rad: number) => rad / RAD_PER_MOA

/** Clock position the wind comes from (12 = straight ahead, 3 = from the right) to radians. */
export const clockToRadians = (hours: number) => ((hours % 12) * Math.PI) / 6
