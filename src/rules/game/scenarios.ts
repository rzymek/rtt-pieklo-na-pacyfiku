import {data, PlaneData} from "./data.js"
import {hexesAround as hexesAroundOn, hexId} from "@rzymek/rally-the-troops-module/rules"
import {isOnBoard} from "./hex.js"

const {Hur, HurL, Spit, SpitL, ME109, ME109L, ME110, ME110L, HE111, JU88} = data.planes

// DIR_OFFSETS indexes, see hex.ts
const N = 0, NE = 1, SE = 2, S = 3, SW = 4, NW = 5

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

export interface Side {
  deployments: Deployment[]
  reinforcements?: Reinforcement[]
  min_vp: number
}

export interface Scenario {
  japonczycy: Side & { aa_guns?: number }
  amerykanie: Side
  targets: string[]
  // 9.2: awarded only for bombing all the targets.
  all_targets_vp?: number
}

function times(count: number, plane: PlaneData): PlaneData[] {
  return Array(count).fill(plane)
}

// The manual lists the 12 hexes of "all strategic points" only on the map: A07.B30 and A16.B19 are in no other scenario.
const ALL_TARGETS = [
  'A03.B04', 'A04.B04', 'A03.B13', 'A04.B24',
  'A06.B19', 'A07.B30', 'A10.B31', 'A11.B13',
  'A12.B09', 'A16.B19', 'A16.B24', 'A18.B32',
]

export const SCENARIOS: Record<string, Scenario> = {
  "Wariant 1": {
    japonczycy: {
      deployments: [{center: 'A10.B08', radius: 1, direction: NE, planes: [SpitL, Spit, Spit]}],
      min_vp: 15,
    },
    amerykanie: {
      deployments: [{center: 'A40.B35', radius: 2, direction: SW, planes: [...times(2, ME110), ...times(4, HE111)]}],
      min_vp: 10,
    },
    targets: ['A06.B19', 'A16.B24'],
  },
  "Wariant 2": {
    japonczycy: {
      deployments: [{center: 'A03.B08', radius: 3, direction: NE, planes: [...times(2, Hur), ...times(3, Spit)]}],
      min_vp: 23,
    },
    amerykanie: {
      deployments: [{
        center: 'A39.B44', radius: 4, direction: SW,
        planes: [...times(3, ME109), ...times(3, ME110), ...times(4, HE111), ...times(4, JU88)],
      }],
      min_vp: 35,
    },
    targets: ['A12.B09', 'A11.B13', 'A04.B24', 'A10.B31'],
    all_targets_vp: 3,
  },
  "Wariant 3": {
    japonczycy: {
      deployments: [{center: 'A08.B17', radius: 3, direction: NE, planes: [SpitL, ...times(6, Spit)]}],
      aa_guns: 12,
      min_vp: 8,
    },
    amerykanie: {
      deployments: [{center: 'A39.B44', radius: 4, direction: SW, planes: [ME110L, ...times(4, ME110)]}],
      min_vp: 20,
    },
    targets: ['A04.B24', 'A03.B13'],
    all_targets_vp: 20,
  },
  "Wariant 4": {
    japonczycy: {
      deployments: [{center: 'A01.B22', radius: 1, direction: SE, planes: [HurL, Hur, Hur]}],
      reinforcements: [
        {stage: 3, plane: Spit, at: 'A01.B09', direction: NE},
        {stage: 3, plane: Spit, at: 'A01.B10', direction: NE},
        {stage: 5, plane: Spit, at: 'A06.B30', direction: S},
        {stage: 5, plane: Spit, at: 'A07.B31', direction: S},
        {stage: 7, plane: Spit, at: 'A01.B01', direction: NE},
        {stage: 7, plane: Spit, at: 'A01.B02', direction: NE},
        {stage: 15, plane: HurL, at: 'A26.B13', direction: N},
        {stage: 15, plane: Hur, at: 'A27.B14', direction: N},
        {stage: 15, plane: Hur, at: 'A28.B14', direction: N},
      ],
      aa_guns: 24,
      min_vp: 33,
    },
    amerykanie: {
      deployments: [{center: 'A39.B28', radius: 3, direction: NW, planes: [ME109L, ...times(6, ME109), ...times(12, HE111)]}],
      min_vp: 33,
    },
    targets: ['A03.B04', 'A04.B04', 'A12.B09', 'A16.B24', 'A18.B32'],
    all_targets_vp: 5,
  },
  "Wariant 5": {
    japonczycy: {
      deployments: [{center: 'A01.B21', radius: 3, direction: SE, planes: [SpitL, ...times(6, Spit)]}],
      reinforcements: [
        {stage: 10, plane: HurL, at: 'A42.B48', direction: SW},
        {stage: 10, plane: Hur, at: 'A42.B47', direction: SW},
        {stage: 10, plane: Hur, at: 'A41.B21', direction: NW},
      ],
      aa_guns: 26,
      min_vp: 55,
    },
    amerykanie: {
      deployments: [
        {center: 'A41.B46', radius: 3, direction: SW, planes: [...times(3, ME109), ...times(8, JU88)]},
        {center: 'A41.B25', radius: 3, direction: NW, planes: [ME110L, ...times(5, ME110), ...times(8, HE111)]},
      ],
      min_vp: 65,
    },
    targets: ALL_TARGETS,
    all_targets_vp: 5,
  },
}

export function boardHexes(): string[] {
  const hexes: string[] = []
  for (let a = 0; a <= 43; a++) {
    const bottom = Math.floor(a / 2)
    for (let b = bottom; b <= bottom + 28; b++) hexes.push(hexId(a, b))
  }
  return hexes
}

// Hexes on the board within the radius, nearest to the center first.
export function hexesAround(center: string, radius: number): string[] {
  return hexesAroundOn(center, radius, isOnBoard)
}
