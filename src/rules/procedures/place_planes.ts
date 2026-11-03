import type {PlaneInstance} from "../types";
import {G, R_Jap, R_Amer, ROLES} from "../globals";
import {ALT_VERY_HIGH, ALTITUDE_ACTIONS, altitudeHandlers, altitudeOf} from "../game/altitude";
import {hexesAround} from "../game/scenarios";
import {select_plane} from "./select_plane";
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide";
import {startMovement} from "./phases";

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
  // 9.0.3: set up at the top altitude, then moved to the one the player chooses.
  return hexesAround(next.center, next.radius).filter(hex => !isOccupiedAt(hex, ALT_VERY_HIGH))
}

// 9.0.3, 4.2.4: any altitude still free on the plane's hex.
function canPlaceAt(plane: PlaneInstance, altitude: number): boolean {
  return altitude !== altitudeOf(plane) && !isOccupiedAt(plane.at, altitude)
}

function setAltitude(altitude: number) {
  const plane = selectedPlaneOfTheActiveSide()
  if (!plane || !canPlaceAt(plane, altitude)) return
  push_undo()
  if (altitude === ALT_VERY_HIGH) delete plane.altitude
  else plane.altitude = altitude
}

// 9.0.2: the players set up their planes on the starting hexes, the Japanese first:
// the manual gives no order; the Americans, who move first (3.0), set up last.
export const placePlanes = {
  inactive: "rozstawianie samolotów",

  prompt() {
    const next = queue()[0]
    prompt(next
      ? `Rozstaw samoloty: ${next.plane.nazwa} – pozostało: ${queue().length}`
      : "Rozstawiono samoloty – możesz jeszcze obrócić wybrany samolot lub zmienić jego wysokość")
    hexesForNext().forEach(hex => action("place_plane", hex))
    button("next_type", queue().some(it => it.plane !== next?.plane))
    G.board.planes[G.active].forEach(plane => action("select_plane", plane.id))
    const selected = selectedPlaneOfTheActiveSide()
    if (selected) {
      button("turn_left")
      button("turn_right")
      for (const [verb, level] of ALTITUDE_ACTIONS) button(verb, canPlaceAt(selected, level))
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

  ...altitudeHandlers(setAltitude),

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
      startMovement()
    }
  },
}
