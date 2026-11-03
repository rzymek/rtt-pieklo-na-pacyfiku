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

function crossesSouthEdge(hex: string, direction: number): boolean {
  const [a, b] = parseHex(hex) as [number, number]
  const [da, db] = DIR_OFFSETS[direction]
  const na = a + da
  return na >= 1 && na <= 56 && b + db < bottomOf(na)
}

export interface Exit {
  // The last hex on the board.
  hex: string
  south: boolean
}

// 4.3.1, 8.1: the ways off the board. Crossing the edge takes one movement point, and counts as the hex required after a turn.
export function exitsFor(plane: PlaneInstance, allPlanes: Board['planes'], altitude = altitudeOf(plane), ignoreOccupied = false): Exit[] {
  const occupied = ignoreOccupied ? [] : occupiedAt(allPlanes, altitude)
  const maxSteps = maxSpeedAt(plane, altitude) - 1
  const turnDist = planeStats(plane).zwrotnosc
  const dir = plane.direction
  const exits = new Map<string, boolean>()
  // The hexes passed, the starting one included.
  const walk = (from: string, direction: number, steps: number): string[] => {
    const hexes = [from]
    for (let s = 0; s < steps; s++) {
      if (isOffBoardStep(hexes[s], direction)) break
      const next = hexStep(hexes[s], direction)!
      if (occupied.includes(next)) break
      hexes.push(next)
    }
    return hexes
  }
  const addExits = (hexes: string[], direction: number) => {
    for (const hex of hexes) {
      if (isOffBoardStep(hex, direction))
        exits.set(hex, !!exits.get(hex) || crossesSouthEdge(hex, direction))
    }
  }
  const straight = walk(plane.at, dir, maxSteps)
  addExits(straight, dir)
  straight.forEach((hex, steps) => {
    if (steps < turnDist) return
    for (const turned of [(dir + 5) % 6, (dir + 1) % 6])
      addExits(walk(hex, turned, maxSteps - steps), turned)
  })
  return [...exits].map(([hex, south]) => ({hex, south}))
}

// Returns {hexId: flight} for all valid destinations.
// Prefers straight path over turning for tie-breaking on direction.
// The range depends on the altitude the plane will end its move at.
// 4.1.1: hexes occupied at that altitude can neither be entered nor flown through.
// 4.2.6: ignoreOccupied is for a plane with no other way to fly.
export function flightsFor(plane: PlaneInstance, allPlanes: Board['planes'], altitude = altitudeOf(plane), ignoreOccupied = false): Record<string, Flight> {
  const maxMp = maxSpeedAt(plane, altitude)
  const minMp = planeStats(plane).predkosc_min
  const turnDist = planeStats(plane).zwrotnosc
  const dir = plane.direction
  const moves: Record<string, Flight> = {}
  const occupied = ignoreOccupied ? [] : occupiedAt(allPlanes, altitude)
  const enter = (from: string | null, direction: number): string | null => {
    if (!from || isOffBoardStep(from, direction)) return null
    const next = hexStep(from, direction)
    return next && !occupied.includes(next) ? next : null
  }

  // Precompute straight path (index = steps taken from start)
  const straight: (string | null)[] = [plane.at]
  for (let s = 1; s <= maxMp; s++)
    straight.push(enter(straight[s - 1], dir))

  // No turn: final direction unchanged
  for (let d = minMp; d <= maxMp; d++)
    if (straight[d]) moves[straight[d]!] = {direction: dir, path: straight.slice(1, d + 1) as string[]}

  // One turn of ±60° after at least turnDist straight steps,
  // followed by at least 1 hex in the new direction
  for (const dTurn of [-1, +1]) {
    const newDir = ((dir + dTurn) + 6) % 6
    for (let s = turnDist; s < maxMp; s++) {
      if (!straight[s]) break
      let pos: string | null = straight[s]
      const path = straight.slice(1, s + 1) as string[]
      for (let r = 1; s + r <= maxMp; r++) {
        pos = enter(pos, newDir)
        if (!pos) break
        path.push(pos)
        if (s + r >= minMp && !(pos in moves))
          moves[pos] = {direction: newDir, path: [...path]}
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
