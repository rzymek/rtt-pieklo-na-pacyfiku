import type {PlaneInstance} from "../types";
import {ALT_HIGH, ALT_LOW, ALT_VERY_LOW, altitudeOf} from "./altitude";
import {cloudPenalty} from "./clouds";
import {hexDistance} from "@rzymek/rally-the-troops-module/rules";
import {LAND_HEXES} from "./terrain";
import {isAgainstSun} from "./sun";

// Table 4: [altitude][distance] = the lowest roll of 1d6 that hits; null = cannot hit.
const AA_TABLE: Record<number, (number | null)[]> = {
  [ALT_HIGH]: [6, null],
  [ALT_LOW]: [5, 6],
  [ALT_VERY_LOW]: [4, 5],
}

// 7.0.6
export const GUN_DESTROYED_FROM = 4

// 6.1, 6.2.5: null when a shot would be pointless, so that no die is rolled.
export function aaHitFrom(gun: string, plane: PlaneInstance): number | null {
  if (plane.destroyed || cloudPenalty(plane) > 0 || isAgainstSun(gun, plane)) return null
  return AA_TABLE[altitudeOf(plane)][hexDistance(gun, plane.at)] ?? null
}

// 6.1.2: one gun per hex, on land only.
export function canPlaceGun(hex: string, guns: string[]): boolean {
  return !guns.includes(hex) && LAND_HEXES.includes(hex)
}
