import {data, PlaneData} from "./data.js"
import {hexesAround as hexesAroundOn, hexId} from "@rzymek/rally-the-troops-module/rules"
import {isOnBoard} from "./hex.js"
import type {ShipKey} from "./ships.js"
import type {Edge} from "./hex.js"
import {byScore, byShip, type VictoryRule} from "./outcomes.js"

const {A6M, A6M6, D3A, D4Y, B5N, B6N, G4M, F4F, P39, F6F, F4U, SBD, SB2C, TBD, TBF, B25, B17} = data.planes

// DIR_OFFSETS indexes, see hex.ts
const NE = 1, SE = 2, SW = 4

// 9.0.2: starting hexes around a center.
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
  reinforcements?: Reinforcement[]
  ships?: ShipSetup[]
  // 6.1.1: land guns, set up anywhere on the island.
  aa_guns?: { count: number, heavy: boolean }
}

// 4.3, 8.0.2 as changed by the scenario for the planes of a side leaving through these edges:
// "lost" counts them as shot down, "return" makes them come back.
export interface ExitRule {
  side: number
  edges: Edge[]
  rule: "lost" | "return"
}

export interface Scenario {
  japonczycy: Side
  amerykanie: Side
  targets: string[]
  exits?: ExitRule[]
  // 8.0.1
  victory: VictoryRule
}

function times(count: number, plane: PlaneData): PlaneData[] {
  return Array(count).fill(plane)
}

// 9: a scenario may load fewer bombs than the plane can carry, or bombs instead of a torpedo.
function withBombs(plane: PlaneData, udzwig_bomb = 1): PlaneData {
  return {...plane, udzwig_bomb, torpeda: false}
}

// 7.3: one torpedo.
function withTorpedo(plane: PlaneData): PlaneData {
  return {...plane, udzwig_bomb: 1, torpeda: true}
}

// 9: planes entering around a hex on the given stage.
function reinforce(stage: number, count: number, plane: PlaneData, at: string, direction: number): Reinforcement[] {
  return Array.from({length: count}, () => ({stage, plane, at, direction}))
}

const ALL_EDGES: Edge[] = ["W", "E", "S", "N"]
const R_AMER = 0, R_JAP = 1
// The first ship of each side, as listed: the main target of the scenario.
const AMERICAN_SHIP = "0.s0", JAPANESE_SHIP = "1.s0"

export const SCENARIOS: Record<string, Scenario> = {
  "1. Atak na Pearl Harbor": {
    japonczycy: {deployments: [{center: 'A49.B39', radius: 2, direction: SW, planes: times(6, A6M)}]},
    amerykanie: {deployments: [{center: 'A10.B07', radius: 2, direction: NE, planes: times(4, F4F)}]},
    targets: [],
    // A plane leaving the board counts as shot down.
    exits: [{side: R_AMER, edges: ALL_EDGES, rule: "lost"}, {side: R_JAP, edges: ALL_EDGES, rule: "lost"}],
    // The Americans lost less the Japanese lost: 4-3, 2-1, 0, (-1)-(-2), (-3)-(-6).
    victory: byScore(t => t.lost[R_AMER] - t.lost[R_JAP], R_JAP, R_AMER, [3, 1, 0, -2]),
  },
  "2. Kampania powietrzna na Filipinach": {
    japonczycy: {
      deployments: [
        {center: 'A11.B12', radius: 2, direction: NE, planes: times(2, A6M)},
        {center: 'A03.B24', radius: 2, direction: NE, planes: times(2, A6M)},
        {center: 'A17.B09', radius: 2, direction: NE, planes: times(2, A6M)},
      ],
      aa_guns: {count: 8, heavy: true},
    },
    amerykanie: {
      deployments: [
        {center: 'A50.B55', radius: 2, direction: SW, planes: times(3, withBombs(B17, 4))},
        {center: 'A50.B38', radius: 2, direction: SW, planes: times(4, withBombs(B25, 2))},
      ],
    },
    targets: ['A03.B10', 'A04.B09', 'A06.B13', 'A09.B08', 'A10.B10', 'A11.B08', 'A13.B11', 'A16.B12'],
    // The edge along the column A01 is the only way out.
    exits: [{side: R_AMER, edges: ["E", "S", "N"], rule: "lost"}],
    // 1 for each object bombed, less 2 for each bomber shot down: 6-8, 2-5, (-2)-1, (-6)-(-3), (-14)-(-7).
    victory: byScore(t => t.bombed - 2 * t.lost[R_AMER], R_AMER, R_JAP, [6, 2, -2, -6]),
  },
  "3. Bitwa pod Kuantan": {
    japonczycy: {
      deployments: [
        {center: 'A02.B02', radius: 3, direction: NE, planes: times(8, withTorpedo(G4M))},
        {center: 'A02.B30', radius: 2, direction: SE, planes: times(4, withBombs(G4M, 2))},
      ],
    },
    amerykanie: {
      deployments: [],
      ships: [{type: "PANCERNIK", nazwa: "Prince of Wales", from: 'A25.B35', towards: 'A29.B35'}],
    },
    targets: [],
    victory: byShip({attacker: R_JAP, defender: R_AMER, ship: AMERICAN_SHIP, heavy: 13, sunk: [3, 6], damaged: [4, 8]}),
  },
  "4.1 Morze Koralowe: atak na Shoho": {
    amerykanie: {
      deployments: [
        {center: 'A50.B49', radius: 2, direction: SW, planes: times(6, F4F)},
        {center: 'A49.B42', radius: 2, direction: SW, planes: times(12, withBombs(SBD))},
        {center: 'A44.B51', radius: 3, direction: SW, planes: times(12, withTorpedo(TBD))},
      ],
    },
    japonczycy: {
      deployments: [{center: 'A05.B11', radius: 4, direction: NE, planes: times(6, A6M)}],
      ships: [
        {type: "SHOHO", from: 'A09.B17', towards: 'A09.B20'},
        {type: "KRAZOWNIK", from: 'A10.B27', towards: 'A12.B27'},
        {type: "NISZCZYCIEL", from: 'A12.B18', towards: 'A13.B19'},
      ],
    },
    targets: [],
    victory: byShip({attacker: R_AMER, defender: R_JAP, ship: JAPANESE_SHIP, heavy: 7, sunk: [4, 8], damaged: [4, 8]}),
  },
  "4.2 Morze Koralowe: atak na Lexington": {
    japonczycy: {
      deployments: [
        {center: 'A04.B20', radius: 2, direction: NE, planes: times(6, A6M)},
        {center: 'A02.B12', radius: 2, direction: NE, planes: times(9, withBombs(D3A))},
        {center: 'A02.B18', radius: 3, direction: NE, planes: times(9, withTorpedo(B5N))},
      ],
    },
    amerykanie: {
      deployments: [
        {center: 'A26.B30', radius: 4, direction: SW, planes: times(3, F4F)},
        {center: 'A20.B26', radius: 2, direction: SW, planes: times(4, SBD)},
      ],
      ships: [
        {type: "LEXINGTON", from: 'A36.B40', towards: 'A40.B40'},
        {type: "NISZCZYCIEL", from: 'A30.B40', towards: 'A31.B41'},
      ],
    },
    targets: [],
    victory: byShip({attacker: R_JAP, defender: R_AMER, ship: AMERICAN_SHIP, heavy: 9, sunk: [3, 6], damaged: [3, 8]}),
  },
  "5.1 Midway: atak na Kaga": {
    amerykanie: {deployments: [{center: 'A02.B20', radius: 2, direction: NE, planes: times(12, withBombs(SBD))}]},
    japonczycy: {
      deployments: [{center: 'A36.B30', radius: 4, direction: SW, planes: times(3, A6M)}],
      ships: [
        {type: "KAGA", from: 'A42.B39', towards: 'A46.B39'},
        {type: "NISZCZYCIEL", from: 'A33.B40', towards: 'A34.B40'},
      ],
    },
    targets: [],
    victory: byShip({attacker: R_AMER, defender: R_JAP, ship: JAPANESE_SHIP, heavy: 10, sunk: [5, 10], damaged: [6, 10]}),
  },
  "5.2 Midway: atak na Yorktown": {
    japonczycy: {
      deployments: [
        {center: 'A03.B20', radius: 2, direction: NE, planes: times(6, A6M)},
        {center: 'A03.B25', radius: 2, direction: NE, planes: times(9, withBombs(D3A))},
      ],
      reinforcements: [
        ...reinforce(5, 3, A6M, 'A02.B20', NE),
        ...reinforce(5, 9, withTorpedo(B5N), 'A02.B15', NE),
      ],
    },
    amerykanie: {
      deployments: [{center: 'A40.B40', radius: 4, direction: SW, planes: times(6, F4F)}],
      ships: [
        {type: "YORKTOWN", from: 'A38.B40', towards: 'A42.B40'},
        {type: "NISZCZYCIEL", from: 'A34.B38', towards: 'A35.B38'},
      ],
    },
    targets: [],
    victory: byShip({attacker: R_JAP, defender: R_AMER, ship: AMERICAN_SHIP, heavy: 7, sunk: [3, 6], damaged: [3, 8]}),
  },
  "6. Operacja I": {
    japonczycy: {
      deployments: [
        {center: 'A50.B40', radius: 4, direction: SW, planes: times(12, A6M)},
        {center: 'A50.B50', radius: 4, direction: SW, planes: times(12, withBombs(D3A))},
      ],
    },
    amerykanie: {
      deployments: [
        {center: 'A04.B04', radius: 4, direction: NE, planes: times(6, F4U)},
        {center: 'A12.B20', radius: 2, direction: NE, planes: times(4, P39)},
      ],
      ships: [
        {type: "NISZCZYCIEL", from: 'A20.B25', towards: 'A21.B25'},
        {type: "TRANSPORTOWIEC", from: 'A14.B24', towards: 'A16.B25'},
        {type: "TRANSPORTOWIEC", from: 'A10.B19', towards: 'A12.B21'},
      ],
      aa_guns: {count: 4, heavy: false},
    },
    targets: ['A16.B12', 'A10.B10', 'A07.B09', 'A04.B09'],
    // Back through the edges with the hex A01.B01.
    exits: [{side: R_JAP, edges: ["W", "S"], rule: "return"}],
    // 2 for each object bombed, 10 for each transport sunk, less 2 for each Japanese plane shot down:
    // 14 and more, 6-13, 0-5, (-7)-(-1), (-14) and less. The table skips (-13)-(-8): taken as the minimal victory.
    victory: byScore(t => 2 * t.bombed + 10 * t.ships.filter(it => it.type === "TRANSPORTOWIEC" && it.sunk).length - 2 * t.lost[R_JAP],
      R_JAP, R_AMER, [14, 6, 0, -13]),
  },
  "7.1 Morze Filipińskie: atak na Hiyo": {
    amerykanie: {
      deployments: [
        {center: 'A02.B20', radius: 2, direction: NE, planes: times(6, F6F)},
        {center: 'A08.B05', radius: 2, direction: NE, planes: times(8, F4U)},
        {center: 'A09.B31', radius: 3, direction: NE, planes: times(12, withTorpedo(TBF))},
        {center: 'A01.B19', radius: 2, direction: NE, planes: times(6, withBombs(SB2C))},
      ],
      reinforcements: reinforce(10, 6, withBombs(SB2C), 'A02.B30', NE),
    },
    japonczycy: {
      deployments: [{center: 'A50.B38', radius: 2, direction: SW, planes: times(8, A6M)}],
      reinforcements: [
        ...reinforce(5, 8, A6M6, 'A46.B30', SW),
        ...reinforce(10, 4, A6M, 'A47.B55', SW),
      ],
      ships: [
        {type: "HIYO", from: 'A42.B41', towards: 'A46.B41'},
        {type: "KRAZOWNIK", from: 'A36.B35', towards: 'A36.B37'},
      ],
    },
    targets: [],
    victory: byShip({attacker: R_AMER, defender: R_JAP, ship: JAPANESE_SHIP, heavy: 9, sunk: [10, 20], damaged: [14, 20]}),
  },
  "7.2 Morze Filipińskie: atak na Bunker Hill": {
    japonczycy: {
      deployments: [
        {center: 'A02.B20', radius: 2, direction: NE, planes: times(12, A6M)},
        {center: 'A08.B05', radius: 2, direction: NE, planes: times(8, A6M6)},
        {center: 'A09.B31', radius: 3, direction: NE, planes: times(12, withTorpedo(B6N))},
      ],
      reinforcements: reinforce(8, 12, withBombs(D4Y), 'A02.B30', NE),
    },
    amerykanie: {
      deployments: [
        {center: 'A46.B30', radius: 4, direction: SW, planes: times(8, F6F)},
        {center: 'A50.B38', radius: 2, direction: SW, planes: times(4, F6F)},
      ],
      reinforcements: reinforce(5, 4, F4U, 'A47.B55', SW),
      ships: [
        {type: "BUNKER_HILL", from: 'A42.B41', towards: 'A46.B41'},
        {type: "NISZCZYCIEL", from: 'A36.B35', towards: 'A36.B36'},
        // The manual has A30-B21, a hex too far from A31-B31 for a destroyer.
        {type: "NISZCZYCIEL", from: 'A30.B31', towards: 'A31.B31'},
      ],
    },
    targets: [],
    victory: byShip({attacker: R_JAP, defender: R_AMER, ship: AMERICAN_SHIP, heavy: 9, sunk: [8, 12], damaged: [8, 12]}),
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
