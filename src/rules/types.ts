import type {BaseGameState} from "@rzymek/rally-the-troops-module/rules"
import type {PlaneData} from "./game/data.js"
import type {Reinforcement} from "./game/scenarios.js"
import type {SunEdge} from "./game/sun.js"
import type {LandGun} from "./game/aa.js"
import type {Ship} from "./game/ships.js"

export interface PlaneInstanceDef {
  plane: PlaneData
  at: string
  direction: number
  altitude?: number
  // 2.2: the boxes crossed out on the plane card.
  damage?: number
  // 2.1.1, 2.2: turned over, at half the endurance.
  damaged?: boolean
  // Out of the game: shot down, or left the board for good.
  destroyed?: boolean
  // 8.1: out of the game, yet not shot down.
  left_board?: boolean
  jammed?: boolean
  // 5.3.4: the guns work again from the next stage on.
  unjammed_stage?: number
  bombs_dropped?: number
  // 6.2: until the end of the stage.
  under_fire?: boolean
}

export interface PlaneInstance extends PlaneInstanceDef {
  id: string;
}

// 4.3.1: waiting on the stage track, outside of G.board.
export interface OffBoardPlane {
  plane: PlaneInstance
  return_stage: number
  from: string
}

// 9.3: a plane its player has yet to set up.
export interface PlaneToPlace {
  id: string
  plane: PlaneData
  center: string
  radius: number
  direction: number
}

export interface StageFlight {
  // The hexes entered.
  path: string[]
  from_altitude: number
  altitude: number
  // No turn.
  straight: boolean
}

export interface Board {
  planes: Record<number, PlaneInstance[]>
}

export interface GameState extends BaseGameState {
  board: Board
  stage: number
  reinforcements?: Record<number, Reinforcement[]>
  to_place?: Record<number, PlaneToPlace[]>
  off_board?: OffBoardPlane[]
  // 4.3, 8.0.2: choosing a way off the board; the hex once the player still has to decide about the return.
  leaving?: boolean
  leaving_from?: string
  targets?: string[]
  moved?: string[]
  selected_plane?: string
  selected_altitude?: number
  selected_target?: string
  shot?: string[]
  // Ending the combat phase while some planes could still fire awaits confirmation.
  confirm_done?: boolean
  // 7.0.2, 7.1, 7.3.1: how each plane flew in this stage.
  flights?: Record<string, StageFlight>
  // 7.0.4: the hexes each plane bombed in this stage.
  bombed_now?: Record<string, string[]>
  ships?: Ship[]
  bombed?: string[]
  aa_guns?: LandGun[]
  aa_fired?: string[]
  selected_gun?: string
  sun?: SunEdge
  // The name of the scenario, for its victory conditions (8.0.1) and special rules.
  scenario?: string
  // The log header of the current phase, written out with the first line of that phase.
  log_phase?: string
}
