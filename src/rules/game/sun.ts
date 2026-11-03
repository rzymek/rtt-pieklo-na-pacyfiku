import type {PlaneInstance} from "../types";
import {G} from "../globals";
import {cloudPenalty} from "./clouds";
import {DIR_OFFSETS, hexDistance, hexId, hexStep, parseHex} from "@rzymek/rally-the-troops-module/rules";
import {isOnBoard} from "./hex";

export type SunEdge = "E" | "S" | "W"

export const SUN_EDGE_NAMES: Record<SunEdge, string> = {E: "wschód", S: "południe", W: "zachód"}

const LENGTH = 10
const range = (from: number) => Array.from({length: LENGTH}, (_, i) => from + i)

// 5.0.1: 1, 2 - east, 3, 4 - south, 5, 6 - west.
export function sunEdgeFor(roll: number): SunEdge {
  return roll <= 2 ? "E" : roll <= 4 ? "S" : "W"
}

// 5.0.1: the edge hexes along the middle of the edge, covered by the 10 hexes long shield.
export function sunHexes(edge: SunEdge): string[] {
  switch (edge) {
    case "W":
      return range(15).map(b => hexId(1, b))
    case "E":
      return range(42).map(b => hexId(56, b))
    case "S":
      return range(24).map(a => hexId(a, Math.floor(a / 2) + 1))
  }
}

// Whether a line going from the hex in the direction leaves the board through the shield.
function facesSun(hex: string, direction: number, edge: SunEdge): boolean {
  let last = hex
  while (true) {
    const next = hexStep(last, direction)
    const [a, b] = next ? parseHex(next) : [null, null]
    if (a === null || !isOnBoard(a, b!)) break
    last = next!
  }
  return sunHexes(edge).includes(last)
}

// The direction of the straight line from one hex to another, if they are on one.
function lineDirection(from: string, to: string): number {
  const [a1, b1] = parseHex(from) as [number, number]
  const [a2, b2] = parseHex(to) as [number, number]
  const da = a2 - a1, db = b2 - b1
  const steps = Math.max(Math.abs(da), Math.abs(db), Math.abs(da - db))
  return DIR_OFFSETS.findIndex(([x, y]) => x * steps === da && y * steps === db)
}

// 5.0.1, 5.0.3; 5.0.6: a rear shot follows its own fire line, not the plane's heading.
export function sunPenalty(attacker: PlaneInstance, target: PlaneInstance, rear = false): number {
  const edge = G?.sun
  if (!edge || cloudPenalty(target) > 0) return 0
  const direction = rear ? lineDirection(attacker.at, target.at) : attacker.direction
  return direction >= 0 && facesSun(attacker.at, direction, edge) ? 1 : 0
}

// The hex direction closest to the way from one hex to another; -1 for the same hex.
function nearestDirection(from: string, to: string): number {
  const distance = hexDistance(from, to)
  if (distance === 0) return -1
  const [a, b] = parseHex(from) as [number, number]
  const missBy = (direction: number) => {
    const [da, db] = DIR_OFFSETS[direction]
    return hexDistance(hexId(a + da * distance, b + db * distance), to)
  }
  return [0, 1, 2, 3, 4, 5].reduce((best, it) => missBy(it) < missBy(best) ? it : best)
}

// 6.3.5: seen from the gun, the plane is against the sun. A plane right above the gun has no direction.
export function isAgainstSun(gun: string, plane: PlaneInstance): boolean {
  const edge = G?.sun
  if (!edge) return false
  const direction = nearestDirection(gun, plane.at)
  return direction >= 0 && facesSun(plane.at, direction, edge)
}
