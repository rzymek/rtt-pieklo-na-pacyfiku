import type {PlaneInstance} from "../types";
import {ALT_HIGH, altitudeOf} from "./altitude";
import {cloudPenalty} from "./clouds";
import {hexDistance} from "@rzymek/rally-the-troops-module/rules";
import {LAND_HEXES} from "./terrain";
import {isAgainstSun} from "./sun";

// Lew Morski's table 4 until the heavy and light guns (6.0.1, 6.0.2) replace it:
// [row][distance] = the lowest roll of 1d6 that hits; null = cannot hit.
const AA_TABLE: (number | null)[][] = [
  [6, null],
  [5, 6],
  [4, 5],
]

function aaRow(altitude: number): number {
  return altitude >= ALT_HIGH ? 0 : altitude > 1 ? 1 : 2
}

// 7.0.6
export const GUN_DESTROYED_FROM = 4

// 6.1, 6.2.5: null when a shot would be pointless, so that no die is rolled.
export function aaHitFrom(gun: string, plane: PlaneInstance): number | null {
  if (plane.destroyed || cloudPenalty(plane) > 0 || isAgainstSun(gun, plane)) return null
  return AA_TABLE[aaRow(altitudeOf(plane))][hexDistance(gun, plane.at)] ?? null
}

// 6.1.2: one gun per hex, on land only.
export function canPlaceGun(hex: string, guns: string[]): boolean {
  return !guns.includes(hex) && LAND_HEXES.includes(hex)
}
