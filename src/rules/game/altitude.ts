import type {PlaneInstance} from "../types";

// Higher value = flying lower.
export const ALT_HIGH = 0
export const ALT_LOW = 1
export const ALT_VERY_LOW = 2

export const ALTITUDE_NAMES = ["wysoko", "nisko", "bardzo nisko"]

export function altitudeOf(plane: PlaneInstance): number {
  return plane.altitude ?? ALT_HIGH
}

// 2.1.1: a damaged plane uses the stats from the reverse of its counter.
export function planeStats(plane: PlaneInstance) {
  return plane.damaged ? plane.plane.reduced : plane.plane
}

function maxSpeed(plane: PlaneInstance): number {
  return planeStats(plane).predkosc_max
}

// 4.2.2 / 4.2.4: descending adds 1 to the speed limit, climbing subtracts 1, for this turn only.
export function maxSpeedAt(plane: PlaneInstance, altitude: number): number {
  return maxSpeed(plane) + Math.sign(altitude - altitudeOf(plane))
}

// 4.2.3 / 4.2.4: one level at a time; a climb must leave the limit at or above the minimum speed.
export function canChangeAltitude(plane: PlaneInstance, altitude: number): boolean {
  if (altitude < ALT_HIGH || altitude > ALT_VERY_LOW) return false
  if (Math.abs(altitude - altitudeOf(plane)) > 1) return false
  return maxSpeedAt(plane, altitude) >= planeStats(plane).predkosc_min
}
