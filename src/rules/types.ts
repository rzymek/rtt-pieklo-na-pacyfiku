import type {BaseGameState} from "@rzymek/rally-the-troops-module/rules"
import type {PlaneData} from "./game/data.js"
import type {Reinforcement} from "./game/scenarios.js"
import type {SunEdge} from "./game/sun.js"
import type {LandGun} from "./game/aa.js"

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
  flown_over?: Record<string, string[]>
  bombed?: string[]
  aa_guns?: LandGun[]
  aa_fired?: string[]
  selected_gun?: string
  sun?: SunEdge
  vp?: Record<number, number>
  min_vp?: Record<number, number>
  all_targets_vp?: number
}
