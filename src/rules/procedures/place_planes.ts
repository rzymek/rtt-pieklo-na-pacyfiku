import type {PlaneInstance} from "../types";
import {G, R_Jap, R_Amer, ROLES} from "../globals";
import {altitudeOf} from "../game/altitude";
import {hexesAround} from "../game/scenarios";
import {select_plane} from "./select_plane";
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide";

export function isOccupiedAt(hex: string, altitude: number): boolean {
  return Object.values(G.board.planes).flat()
    .some(plane => !plane.destroyed && plane.at === hex && altitudeOf(plane) === altitude)
}

export function turnSelected(by: number) {
  const plane = selectedPlaneOfTheActiveSide()
  if (!plane) return
  push_undo()
  plane.direction = (plane.direction + by + 6) % 6
}

function queue() {
  return G.to_place?.[G.active] ?? []
}

function hexesForNext(): string[] {
  const next = queue()[0]
  if (!next) return []
  // 4.2.1: every plane starts flying high.
  return hexesAround(next.center, next.radius).filter(hex => !isOccupiedAt(hex, 0))
}

// 9.3: the players set up their planes on the starting hexes, the British first:
// the manual gives no order, and this way they cannot react to the German setup.
export const placePlanes = {
  inactive: "rozstawianie samolotów",

  prompt() {
    const next = queue()[0]
    prompt(next
      ? `Rozstaw samoloty: ${next.plane.nazwa} – pozostało: ${queue().length}`
      : "Rozstawiono samoloty – możesz jeszcze obrócić wybrany samolot")
    hexesForNext().forEach(hex => action("place_plane", hex))
    button("next_type", queue().some(it => it.plane !== next?.plane))
    G.board.planes[G.active].forEach(plane => action("select_plane", plane.id))
    if (selectedPlaneOfTheActiveSide()) {
      button("turn_left")
      button("turn_right")
    }
    button("done", queue().length === 0)
  },

  select_plane,

  place_plane(hex: string) {
    if (!hexesForNext().includes(hex)) return
    push_undo()
    const {id, plane, direction} = queue().shift()!
    const placed: PlaneInstance = {id, plane, at: hex, direction}
    G.board.planes[G.active].push(placed)
    G.selected_plane = id
  },

  // The queue keeps the planes of one type together.
  next_type() {
    const list = queue()
    const first = list[0]
    if (!first) return
    push_undo()
    const others = list.filter(it => it.plane !== first.plane)
    G.to_place![G.active] = [...others, ...list.filter(it => it.plane === first.plane)]
  },

  turn_left() {
    turnSelected(-1)
  },

  turn_right() {
    turnSelected(+1)
  },

  done() {
    if (queue().length > 0) return
    clear_undo()
    delete G.selected_plane
    log(`${ROLES[G.active]}: rozstawiono samoloty`)
    if (G.active === R_Jap) {
      G.active = R_Amer
    } else {
      delete G.to_place
      goto("move_planes")
    }
  },
}
