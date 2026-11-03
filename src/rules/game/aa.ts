import type {PlaneInstance} from "../types";
import {ALT_HIGH, ALT_LOW, ALT_VERY_HIGH, altitudeOf} from "./altitude";
import {cloudPenalty} from "./clouds";
import {hexDistance} from "@rzymek/rally-the-troops-module/rules";
import {LAND_HEXES} from "./terrain";
import {isAgainstSun} from "./sun";

// 6.1.2: a land gun, one to a hex.
export interface LandGun {
  hex: string
  side: number
  // 6.0.1: heavy, or 6.0.2: light.
  heavy: boolean
}

// A gun able to fire: on land, or on a ship (6.1.3), which fires from any of its hexes (6.1.4).
export interface AaGun {
  id: string
  // For the log: the hex of a land gun, the ship of a ship's one.
  label: string
  side: number
  heavy: boolean
  hexes: string[]
}

type Range = [number, number] | null
const rolls = (from: number, to = from): Range => [from, to]
// [under fire, hit]: within the first range the plane is under fire only, within the second it is hit as well.
type Band = [Range, Range]

// Tables 9 and 10: [altitude 1-3, 4, 5][distance 0-4, 5-6, 7-8]
const HEAVY_TABLE: Band[][] = [
  [[rolls(8, 9), rolls(10, 12)], [rolls(8, 9), rolls(10, 12)], [rolls(8, 9), rolls(10, 11)]],
  [[rolls(8, 9), rolls(10, 12)], [rolls(8, 9), rolls(10, 11)], [rolls(8, 9), rolls(11, 12)]],
  [[rolls(9, 10), rolls(11, 12)], [rolls(9, 10), rolls(11)], [rolls(8, 9), rolls(12)]],
]
const LIGHT_TABLE: Band[][] = [
  [[rolls(7, 8), rolls(9, 12)], [rolls(7, 8), rolls(9, 12)], [rolls(8, 9), rolls(10, 12)]],
  [[rolls(8, 9), rolls(10, 12)], [rolls(8, 9), rolls(10, 12)], [rolls(8, 9), rolls(10, 11)]],
  [[rolls(9, 10), rolls(11, 12)], [rolls(9, 10), rolls(11)], [rolls(10, 11), rolls(12)]],
]

// 6.0.1, 6.0.2
export const HEAVY_RANGE = 8
export const LIGHT_RANGE = 5
export const HEAVY_DAMAGE = 3
export const LIGHT_DAMAGE = 2
// 6.3.5
const CLOUD_OR_SUN_PENALTY = 2
// 7.0.6
export const GUN_DESTROYED_FROM = 4

export function aaDistance(gun: AaGun, plane: PlaneInstance): number {
  return Math.min(...gun.hexes.map(hex => hexDistance(hex, plane.at)))
}

// 6.0.1: a heavy gun reaches 8 hexes, at every altitude; 6.0.2: a light one 5 hexes, below the top altitude.
export function canFireAt(gun: AaGun, plane: PlaneInstance): boolean {
  if (plane.destroyed) return false
  if (gun.heavy) return aaDistance(gun, plane) <= HEAVY_RANGE
  return aaDistance(gun, plane) <= LIGHT_RANGE && altitudeOf(plane) < ALT_VERY_HIGH
}

function band(gun: AaGun, plane: PlaneInstance): Band {
  const altitude = altitudeOf(plane)
  const row = altitude <= ALT_LOW ? 0 : altitude === ALT_HIGH ? 1 : 2
  const distance = aaDistance(gun, plane)
  const column = distance <= 4 ? 0 : distance <= 6 ? 1 : 2
  return (gun.heavy ? HEAVY_TABLE : LIGHT_TABLE)[row][column]
}

// 6.3.5: a plane in the clouds or against the sun.
export function aaPenalty(gun: AaGun, plane: PlaneInstance): number {
  return cloudPenalty(plane) > 0 || gun.hexes.some(hex => isAgainstSun(hex, plane)) ? CLOUD_OR_SUN_PENALTY : 0
}

const within = (range: Range, roll: number) => !!range && roll >= range[0] && roll <= range[1]

export interface AaShot {
  // 6.2: the "under fire" counter, for the bombs and torpedoes (7.2).
  underFire: boolean
  damage: number
}

// 6.2
export function aaShot(gun: AaGun, plane: PlaneInstance, roll: number): AaShot {
  const [underFire, hit] = band(gun, plane)
  const modified = roll - aaPenalty(gun, plane)
  const isHit = within(hit, modified)
  return {underFire: isHit || within(underFire, modified), damage: isHit ? (gun.heavy ? HEAVY_DAMAGE : LIGHT_DAMAGE) : 0}
}

function show(range: Range) {
  return range ? (range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`) : "–"
}

// The odds of a shot, for the player choosing a target.
export function describeAaShot(gun: AaGun, plane: PlaneInstance): string {
  const [underFire, hit] = band(gun, plane)
  const penalty = aaPenalty(gun, plane)
  return `${plane.plane.nazwa}, odl. ${aaDistance(gun, plane)}: pod ostrzałem ${show(underFire)}, trafienie ${show(hit)}${penalty ? ` (−${penalty} do rzutu: chmury lub słońce)` : ""}`
}

// 6.1.2: one gun per hex, on land only.
export function canPlaceGun(hex: string, guns: LandGun[]): boolean {
  return !guns.some(it => it.hex === hex) && LAND_HEXES.includes(hex)
}
