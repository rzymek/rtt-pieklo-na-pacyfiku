import {DIR_OFFSETS, hexStep, isEdgeHex as isEdgeHexOn, isOffBoardStep as isOffBoardStepOn, parseHex} from "@rzymek/rally-the-troops-module/rules";
import {Board, PlaneInstance} from "../types";
import {altitudeOf, maxSpeedAt, planeStats} from "./altitude";

// Columns A01-A56; the odd ones are a hex longer, sticking out at the top and at the bottom.
export function isOnBoard(a: number, b: number) {
  return a >= 1 && a <= 56 && b >= bottomOf(a) && b <= Math.floor((a + 1) / 2) + 37
}

function bottomOf(a: number) {
  return Math.floor(a / 2) + 1
}

function isOffBoardStep(hex: string, direction: number): boolean {
  return isOffBoardStepOn(hex, direction, isOnBoard)
}

// 4.3.1
export function isEdgeHex(hex: string): boolean {
  return isEdgeHexOn(hex, isOnBoard)
}

export interface Flight {
  direction: number
  // Hexes entered on the way, destination included.
  path: string[]
}

function occupiedAt(allPlanes: Board['planes'], altitude: number): string[] {
  return Object.values(allPlanes).flat()
    .filter(p => !p.destroyed && altitudeOf(p) === altitude)
    .map(p => p.at)
}

function lastOf(hexes: string[], start: string): string {
  return hexes.length > 0 ? hexes[hexes.length - 1] : start
}

// 4.1.1, 4.2.1: the altitude may change on any hex of the way. The plane flies at its old altitude
// up to that hex and at the new one from it on; a hex occupied at the altitude it is flown at
// can be neither entered nor flown through. Without a change both are the same.
// Returns the index of the earliest hex of the path that may be the first one at the new altitude
// (path.length: past the last one), or -1 if there is none.
type AltitudeChange = (path: string[]) => number

function altitudeChange(plane: PlaneInstance, allPlanes: Board['planes'], altitude: number, ignoreOccupied: boolean): AltitudeChange {
  const before = ignoreOccupied ? [] : occupiedAt(allPlanes, altitudeOf(plane))
  const after = ignoreOccupied ? [] : occupiedAt(allPlanes, altitude)
  return path => {
    const firstBlockedBefore = path.findIndex(hex => before.includes(hex))
    let change = path.length
    while (change > 0 && !after.includes(path[change - 1])) change--
    return change <= (firstBlockedBefore === -1 ? path.length : firstBlockedBefore) ? change : -1
  }
}

// The map edges: west along column A01, east along A56, south and north along the ends of the columns.
export type Edge = "W" | "E" | "S" | "N"

// The edge a step off the board crosses.
export function edgeCrossed(hex: string, direction: number): Edge {
  const [a, b] = parseHex(hex) as [number, number]
  const [da, db] = DIR_OFFSETS[direction]
  const na = a + da, nb = b + db
  if (na < 1) return "W"
  if (na > 56) return "E"
  return nb < bottomOf(na) ? "S" : "N"
}

export interface Exit {
  // The last hex on the board.
  hex: string
  edge: Edge
}

// 4.3.1, 8.1: the ways off the board. Crossing the edge takes one movement point, and counts as the hex required after a turn.
// The altitude may change as late as on crossing the edge.
export function exitsFor(plane: PlaneInstance, allPlanes: Board['planes'], altitude = altitudeOf(plane), ignoreOccupied = false): Exit[] {
  const change = altitudeChange(plane, allPlanes, altitude, ignoreOccupied)
  const maxSteps = maxSpeedAt(plane, altitude) - 1
  const turnDist = planeStats(plane).zwrotnosc
  const dir = plane.direction
  const exits = new Map<string, Edge>()
  // The hexes entered after the ones already flown through.
  const walk = (flown: string[], from: string, direction: number, steps: number): string[] => {
    const hexes: string[] = []
    for (let s = 0; s < steps; s++) {
      const last = lastOf(hexes, from)
      if (isOffBoardStep(last, direction)) break
      const next = hexStep(last, direction)
      if (!next || change([...flown, ...hexes, next]) < 0) break
      hexes.push(next)
    }
    return hexes
  }
  const addExits = (hexes: string[], direction: number) => {
    for (const hex of hexes) {
      if (isOffBoardStep(hex, direction))
        if (!exits.has(hex)) exits.set(hex, edgeCrossed(hex, direction))
    }
  }
  const straight = walk([], plane.at, dir, maxSteps)
  addExits([plane.at, ...straight], dir)
  for (let steps = turnDist; steps <= straight.length; steps++) {
    const from = steps === 0 ? plane.at : straight[steps - 1]
    const flown = straight.slice(0, steps)
    for (const turned of [(dir + 5) % 6, (dir + 1) % 6])
      addExits([from, ...walk(flown, from, turned, maxSteps - steps)], turned)
  }
  return [...exits].map(([hex, edge]) => ({hex, edge}))
}

// Returns {hexId: flight} for all valid destinations.
// Prefers straight path over turning for tie-breaking on direction.
// The range depends on the altitude the plane will end its move at.
// 4.1.1, 4.2.1: the altitude changes on some hex of the way, at the latest on the destination,
// so a plane may pass another one by changing its altitude before reaching it.
// 4.2.6: ignoreOccupied is for a plane with no other way to fly.
export function flightsFor(plane: PlaneInstance, allPlanes: Board['planes'], altitude = altitudeOf(plane), ignoreOccupied = false): Record<string, Flight> {
  const maxMp = maxSpeedAt(plane, altitude)
  const minMp = planeStats(plane).predkosc_min
  const turnDist = planeStats(plane).zwrotnosc
  const dir = plane.direction
  const moves: Record<string, Flight> = {}
  const change = altitudeChange(plane, allPlanes, altitude, ignoreOccupied)
  const enter = (from: string, direction: number): string | null =>
    isOffBoardStep(from, direction) ? null : hexStep(from, direction)
  const add = (path: string[], direction: number) => {
    const to = path[path.length - 1]
    // The destination is flown at the new altitude.
    const at = change(path)
    if (path.length >= minMp && !(to in moves) && at >= 0 && at < path.length)
      moves[to] = {direction, path: [...path]}
  }

  // The hexes entered flying straight on, as long as the altitude can still change somewhere on the way.
  const straight: string[] = []
  for (let s = 1; s <= maxMp; s++) {
    const next = enter(lastOf(straight, plane.at), dir)
    if (!next || change([...straight, next]) < 0) break
    straight.push(next)
  }

  // No turn: final direction unchanged
  for (let d = 1; d <= straight.length; d++)
    add(straight.slice(0, d), dir)

  // One turn of ±60° after at least turnDist straight steps,
  // followed by at least 1 hex in the new direction
  for (const dTurn of [-1, +1]) {
    const newDir = ((dir + dTurn) + 6) % 6
    for (let s = turnDist; s < maxMp && s <= straight.length; s++) {
      const path = straight.slice(0, s)
      for (let r = 1; s + r <= maxMp; r++) {
        const next = enter(lastOf(path, plane.at), newDir)
        if (!next) break
        path.push(next)
        if (change(path) < 0) break
        add(path, newDir)
      }
    }
  }

  return moves
}
// Returns {hexId: finalDirection} for all valid destinations.
export function movesMapFor(plane: PlaneInstance, allPlanes: Board['planes'], altitude = altitudeOf(plane), ignoreOccupied = false): Record<string, number> {
  const flights = flightsFor(plane, allPlanes, altitude, ignoreOccupied)
  return Object.fromEntries(Object.entries(flights).map(([hex, flight]) => [hex, flight.direction]))
}

export function possibleMovesFor(plane: PlaneInstance, allPlanes: Board['planes'], altitude = altitudeOf(plane), ignoreOccupied = false): string[] {
  const result: string[] = []
  for (const h of Object.keys(movesMapFor(plane, allPlanes, altitude, ignoreOccupied)))
    set_add(result, h)
  return result
}
