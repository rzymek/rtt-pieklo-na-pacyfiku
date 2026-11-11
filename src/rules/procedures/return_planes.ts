import type {OffBoardPlane} from "../types";
import {G} from "../globals";
import {logEvent} from "./log";
import {altitudeOf} from "../game/altitude";
import {isEdgeHex} from "../game/hex";
import {hexesAround} from "../game/scenarios";
import {isOccupiedAt, turnSelected} from "./place_planes";
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide";

const RETURN_RADIUS = 5

// 4.3.1: a free edge hex within 5 hexes from the one the plane left through.
export function returnHexes({plane, from}: OffBoardPlane): string[] {
  return hexesAround(from, RETURN_RADIUS)
    .filter(hex => isEdgeHex(hex) && !isOccupiedAt(hex, altitudeOf(plane)))
}

// Without a free hex the plane waits for the next movement phase of its side.
export function nextToReturn(): OffBoardPlane | undefined {
  return (G.off_board ?? []).find(it =>
    parseInt(it.plane.id) === G.active && it.return_stage <= G.stage && returnHexes(it).length > 0)
}

export const returnPlanes = {
  inactive: "powrót samolotów na planszę",

  prompt() {
    const next = nextToReturn()
    prompt(next
      ? `Powrót na planszę: ${next.plane.plane.nazwa} – wybierz brzegowy heks`
      : "Samoloty wróciły – możesz jeszcze obrócić ostatni samolot")
    if (next) returnHexes(next).forEach(hex => action("return_hex", hex))
    if (selectedPlaneOfTheActiveSide()) {
      button("turn_left")
      button("turn_right")
    }
    button("done", !next)
  },

  return_hex(hex: string) {
    const next = nextToReturn()
    if (!next || !returnHexes(next).includes(hex)) return
    push_undo()
    next.plane.at = hex
    G.board.planes[G.active].push(next.plane)
    G.off_board = G.off_board!.filter(it => it !== next)
    G.selected_plane = next.plane.id
    logEvent(G.active, `${next.plane.plane.nazwa} wraca na planszę na ${hex}`)
  },

  turn_left() {
    turnSelected(-1)
  },

  turn_right() {
    turnSelected(+1)
  },

  done() {
    if (nextToReturn()) return
    clear_undo()
    delete G.selected_plane
    goto("move_planes")
  },
}
