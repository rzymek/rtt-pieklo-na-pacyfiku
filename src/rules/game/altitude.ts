import type {PlaneInstance} from "../types";

// 4.2.1: higher value = flying higher.
export const ALT_LOWEST = 1
export const ALT_VERY_LOW = 2
export const ALT_LOW = 3
export const ALT_HIGH = 4
// 4.2.4: the only one without an altitude counter.
export const ALT_VERY_HIGH = 5

export const ALTITUDES = [ALT_LOWEST, ALT_VERY_LOW, ALT_LOW, ALT_HIGH, ALT_VERY_HIGH]

export const ALTITUDE_NAMES: Record<number, string> = {
  [ALT_LOWEST]: "najniżej",
  [ALT_VERY_LOW]: "bardzo nisko",
  [ALT_LOW]: "nisko",
  [ALT_HIGH]: "wysoko",
  [ALT_VERY_HIGH]: "bardzo wysoko",
}

// The buttons choosing an altitude.
export type AltitudeVerb = `wysokosc_${1 | 2 | 3 | 4 | 5}`

export const ALTITUDE_ACTIONS = ALTITUDES.map(level => [`wysokosc_${level}`, level]) as [AltitudeVerb, number][]

export function altitudeHandlers(select: (altitude: number) => void): Record<AltitudeVerb, () => void> {
  return Object.fromEntries(ALTITUDE_ACTIONS.map(([verb, level]) => [verb, () => select(level)])) as Record<AltitudeVerb, () => void>
}

export function altitudeOf(plane: PlaneInstance): number {
  return plane.altitude ?? ALT_VERY_HIGH
}

// 2.1.1: a damaged plane uses the stats from the reverse of its counter.
export function planeStats(plane: PlaneInstance) {
  return plane.damaged ? plane.plane.reduced : plane.plane
}

function maxSpeed(plane: PlaneInstance): number {
  return planeStats(plane).predkosc_max
}

// 4.2.2, 4.2.3: descending adds 1 to the speed limit, climbing subtracts 1, for this stage only.
export function maxSpeedAt(plane: PlaneInstance, altitude: number): number {
  return maxSpeed(plane) + Math.sign(altitudeOf(plane) - altitude)
}

// 4.2.2: down by 1 or 2 levels; 4.2.3: up by one, if the limit stays at or above the minimum speed.
export function canChangeAltitude(plane: PlaneInstance, altitude: number): boolean {
  if (!ALTITUDES.includes(altitude)) return false
  const change = altitude - altitudeOf(plane)
  if (change < -2 || change > 1) return false
  return maxSpeedAt(plane, altitude) >= planeStats(plane).predkosc_min
}
