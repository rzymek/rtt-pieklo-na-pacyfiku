import type {PlaneInstance} from "../types";
import {G} from "../globals";
import {cloudPenalty} from "./clouds";
import {DIR_OFFSETS, hexId, hexStep, parseHex} from "@rzymek/rally-the-troops-module/rules";
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

// 5.0.1, 5.0.3
export function sunPenalty(attacker: PlaneInstance, target: PlaneInstance): number {
  const edge = G?.sun
  if (!edge || cloudPenalty(target) > 0) return 0
  return facesSun(attacker.at, attacker.direction, edge) ? 1 : 0
}

// 6.2.5: seen from the gun, the plane is against the sun. A plane right above the gun has no direction.
export function isAgainstSun(gun: string, plane: PlaneInstance): boolean {
  const edge = G?.sun
  if (!edge) return false
  const [a1, b1] = parseHex(gun) as [number, number]
  const [a2, b2] = parseHex(plane.at) as [number, number]
  const direction = DIR_OFFSETS.findIndex(([da, db]) => a1 + da === a2 && b1 + db === b2)
  return direction >= 0 && facesSun(plane.at, direction, edge)
}
