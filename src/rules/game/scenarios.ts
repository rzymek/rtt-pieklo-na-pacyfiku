import {data, PlaneData} from "./data.js"
import {hexesAround as hexesAroundOn, hexId} from "@rzymek/rally-the-troops-module/rules"
import {isOnBoard} from "./hex.js"
import type {ShipKey} from "./ships.js"

const {A6M, F4F, B17, B25} = data.planes

// DIR_OFFSETS indexes, see hex.ts
const NE = 1, SW = 4

// 9.3: starting hexes around a center.
export interface Deployment {
  center: string
  radius: number
  direction: number
  planes: PlaneData[]
}

// 9: planes entering on the given stage, in the movement phase of their side.
export interface Reinforcement {
  stage: number
  plane: PlaneData
  at: string
  direction: number
}

// 9: a ship from one hex towards another, as long as table 3 says.
export interface ShipSetup {
  type: ShipKey
  nazwa?: string
  from: string
  towards: string
}

export interface Side {
  deployments: Deployment[]
  ships?: ShipSetup[]
  // 6.1.1: land guns, set up anywhere on the island.
  aa_guns?: { count: number, heavy: boolean }
  reinforcements?: Reinforcement[]
  // Lew Morski's victory points, until the scenario victory conditions (8) replace them.
  min_vp: number
}

export interface Scenario {
  japonczycy: Side
  amerykanie: Side
  targets: string[]
  all_targets_vp?: number
}

function times(count: number, plane: PlaneData): PlaneData[] {
  return Array(count).fill(plane)
}

// 9: a scenario may load fewer bombs than the plane can carry.
function withBombs(plane: PlaneData, udzwig_bomb: number): PlaneData {
  return {...plane, udzwig_bomb}
}

export const SCENARIOS: Record<string, Scenario> = {
  "1. Atak na Pearl Harbor": {
    japonczycy: {
      deployments: [{center: 'A49.B39', radius: 2, direction: SW, planes: times(6, A6M)}],
      min_vp: 1,
    },
    amerykanie: {
      deployments: [{center: 'A10.B07', radius: 2, direction: NE, planes: times(4, F4F)}],
      min_vp: 1,
    },
    targets: [],
  },
  "2. Kampania powietrzna na Filipinach": {
    japonczycy: {
      deployments: [
        {center: 'A11.B12', radius: 2, direction: NE, planes: times(2, A6M)},
        {center: 'A03.B24', radius: 2, direction: NE, planes: times(2, A6M)},
        {center: 'A17.B09', radius: 2, direction: NE, planes: times(2, A6M)},
      ],
      aa_guns: {count: 8, heavy: true},
      min_vp: 1,
    },
    amerykanie: {
      deployments: [
        {center: 'A50.B55', radius: 2, direction: SW, planes: times(3, withBombs(B17, 4))},
        {center: 'A50.B38', radius: 2, direction: SW, planes: times(4, withBombs(B25, 2))},
      ],
      min_vp: 1,
    },
    targets: ['A03.B10', 'A04.B09', 'A06.B13', 'A09.B08', 'A10.B10', 'A11.B08', 'A13.B11', 'A16.B12'],
  },
}

export function boardHexes(): string[] {
  const hexes: string[] = []
  for (let a = 1; a <= 56; a++) {
    for (let b = 1; b <= 70; b++) if (isOnBoard(a, b)) hexes.push(hexId(a, b))
  }
  return hexes
}

// Hexes on the board within the radius, nearest to the center first.
export function hexesAround(center: string, radius: number): string[] {
  return hexesAroundOn(center, radius, isOnBoard)
}
