import type {BaseViewState} from "@rzymek/rally-the-troops-module/rules";
import type {SunEdge} from "../rules/game/sun";

export interface ViewPlaneInstance {
  id: string;
  plane: { img: string, udzwig_bomb: number | null, wytrzymalosc: number }
  at: string
  direction: number
  altitude?: number
  damage?: number
  damaged?: boolean
  destroyed?: boolean
  left_board?: boolean
  jammed?: boolean
  bombs_dropped?: number
  under_fire?: boolean
}

export interface ViewActions {
  move_hex?: string[]
  select_plane?: string[]
  wysokosc_1?: number
  wysokosc_2?: number
  wysokosc_3?: number
  wysokosc_4?: number
  wysokosc_5?: number
  attack?: number
  unjam?: number
  bomb?: string[]
  torpedo?: string[]
  place_gun?: string[]
  place_plane?: string[]
  return_hex?: string[]
  leave_hex?: string[]
  leave_return?: number
  leave_forever?: number
  next_type?: number
  turn_left?: number
  turn_right?: number
  select_gun?: string[]
  aa_fire?: string[]
  target?: string[]
  deselect?: number
  leave_board?: number
  undo?: number
  done?: number
}

/** What on_view sends to the client. */
export interface View extends BaseViewState<ViewActions> {
  board: { planes: Record<number, ViewPlaneInstance[]> }
  active_side: number
  stage?: number
  off_board?: { name: string, side: number, return_stage: number, hexes: string[] }[]
  unmoved?: string[]
  moves?: Record<string, number>
  selected_plane?: string
  fire_line?: string[]
  fire_target?: string
  shot?: string[]
  bombed?: string[]
  targets?: string[]
  aa_guns?: { id: string, side: number, heavy: boolean, hexes: string[] }[]
  ships?: { id: string, side: number, type: string, nazwa: string, hexes: string[], damage?: number, sunk?: boolean, wytrzymalosc: number }[]
  aa_fired?: string[]
  selected_gun?: string
  sun?: SunEdge
  sun_hexes?: string[]
  // Planes lost, by side.
  lost?: Record<number, number>
  // 8.0.1: the outcome if the game ended now.
  standing?: string
}
