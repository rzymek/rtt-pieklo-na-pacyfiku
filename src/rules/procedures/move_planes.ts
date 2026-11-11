import {G, ROLES} from "../globals.js"
import {Edge, exitsFor, flightsFor, possibleMovesFor} from "../game/hex.js"
import {SCENARIOS} from "../game/scenarios";
import {ALTITUDE_ACTIONS, ALTITUDE_NAMES, altitudeHandlers, altitudeOf, canChangeAltitude} from "../game/altitude";
import {endMovement} from "./phases";
import {select_plane} from "./select_plane.js";
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide";
import type {PlaneInstance} from "../types";
import {logAttack, logEvent, logLoss} from "./log";

function selectAltitude(altitude: number) {
  const plane = selectedPlaneOfTheActiveSide();
  if (!plane || !canChangeAltitude(plane, altitude)) return
  if (altitude === altitudeOf(plane)) {
    delete G.selected_altitude
  } else {
    G.selected_altitude = altitude
  }
}

const RETURN_AFTER_STAGES = 5
const COLLISION_ROLL = 6

// 4.2.6: only when no altitude within reach leaves any other way to fly.
export function isForced(plane: PlaneInstance): boolean {
  return ALTITUDE_ACTIONS.every(([, level]) => !canChangeAltitude(plane, level)
    || (Object.keys(flightsFor(plane, G.board.planes, level)).length === 0
      && exitsFor(plane, G.board.planes, level).length === 0))
}

function exits(plane: PlaneInstance) {
  return exitsFor(plane, G.board.planes, G.selected_altitude, isForced(plane))
}

// 9: the scenario may count a plane leaving through an edge as shot down, or make it come back.
function exitRule(side: number, edge: Edge): "lost" | "return" | undefined {
  const rules = G.scenario === undefined ? [] : SCENARIOS[G.scenario].exits ?? []
  return rules.find(it => it.side === side && it.edges.includes(edge))?.rule
}

function takeOffBoard(plane: PlaneInstance, from: string) {
  plane.at = from
  plane.altitude = G.selected_altitude ?? altitudeOf(plane)
  const side = G.active
  G.board.planes[side] = G.board.planes[side].filter(it => it !== plane)
  G.off_board ??= []
  const return_stage = G.stage + RETURN_AFTER_STAGES
  G.off_board.push({plane, return_stage, from})
  logEvent(side, `${plane.plane.nazwa} opuszcza planszę na ${from} – powrót w etapie ${return_stage}`)
  clearSelection()
}

function clearSelection() {
  delete G.selected_plane
  delete G.selected_altitude
  delete G.leaving
  delete G.leaving_from
}

// 4.2.6
function collide(plane: PlaneInstance) {
  const others = Object.values(G.board.planes).flat()
    .filter(it => it !== plane && !it.destroyed && it.at === plane.at && altitudeOf(it) === altitudeOf(plane))
  if (others.length === 0) return
  clear_undo()
  const roll = random(6) + 1
  if (roll !== COLLISION_ROLL) {
    logAttack(G.active, `${plane.plane.nazwa} wlatuje na zajęty heks ${plane.at}`, `rzut ${roll}`, "bez kolizji")
    return
  }
  logAttack(G.active, `${plane.plane.nazwa} wlatuje na zajęty heks ${plane.at}`, `rzut ${roll}`, "zderzenie – oba zniszczone")
  for (const it of [plane, ...others]) {
    it.destroyed = true
  }
}

function hasMoved(plane: PlaneInstance): boolean {
  return set_has(G.moved ?? [], plane.id)
}

// 4.0: every plane has to move, at least by its minimum speed.
function unmovedPlanes(): PlaneInstance[] {
  return G.board.planes[G.active].filter(plane => !plane.destroyed && !hasMoved(plane))
}

function selectablePlanes(): PlaneInstance[] {
  return G.board.planes[G.active].filter(plane => !plane.destroyed && !hasMoved(plane))
}

export const movePlanes = {
  inactive: "faza ruchu samolotów",

  prompt() {
    const selected = selectedPlaneOfTheActiveSide();
    if (selected !== undefined && G.leaving_from !== undefined) {
      prompt(`${selected.plane.nazwa} opuszcza planszę na ${G.leaving_from} – czy wróci do gry?`)
      button("leave_return")
      button("leave_forever")
      return
    }
    if (selected !== undefined && G.leaving) {
      prompt(`${selected.plane.nazwa} – wybierz heks, przez który opuści planszę`)
      exits(selected).forEach(({hex}) => action("leave_hex", hex))
      return
    }
    if (selected !== undefined) {
      const altitude = G.selected_altitude ?? altitudeOf(selected)
      const forced = isForced(selected)
      prompt(`faza ruchu samolotów ${ROLES[G.active]} – koniec ruchu na wysokości: ${ALTITUDE_NAMES[altitude]}${forced ? " – brak wolnej drogi, wejście na zajęty heks grozi zderzeniem" : ""}`)
      for (const [verb, level] of ALTITUDE_ACTIONS) {
        button(verb, level !== altitude && canChangeAltitude(selected, level))
      }
      if (exits(selected).length > 0) button("leave_board")
    } else {
      prompt(`faza ruchu samolotów ${ROLES[G.active]}`)
    }
    button("done", unmovedPlanes().length === 0)
    if (selected !== undefined) {
      for (const hex of possibleMovesFor(selected, G.board.planes, G.selected_altitude, isForced(selected))) {
        action("move_hex", hex)
      }
      action("select_plane", G.selected_plane)
    } else {
      selectablePlanes().forEach(plane => action("select_plane", plane.id))
    }
  },

  done() {
    if (unmovedPlanes().length > 0) return
    // Undo back into the movement phase stays possible until a die is rolled in combat
    // (the framework drops it anyway when the turn passes to the other side).
    push_undo()
    G.moved = []
    delete G.selected_plane
    endMovement()
  },

  select_plane,

  deselect() {
    delete G.selected_plane
  },

  ...altitudeHandlers(selectAltitude),

  leave_board() {
    const plane = selectedPlaneOfTheActiveSide();
    if (!plane || G.leaving || exits(plane).length === 0) return
    push_undo()
    G.leaving = true
  },

  leave_hex(hex: string) {
    const plane = selectedPlaneOfTheActiveSide();
    const exit = plane && G.leaving ? exits(plane).find(it => it.hex === hex) : undefined
    if (!plane || !exit) return
    push_undo()
    const rule = exitRule(G.active, exit.edge)
    if (rule === "lost") {
      plane.at = hex
      plane.altitude = G.selected_altitude ?? altitudeOf(plane)
      plane.destroyed = true
      logLoss(G.active, `${plane.plane.nazwa} opuszcza planszę na ${hex} – uznany za zestrzelony`)
      clearSelection()
    } else if (rule === "return") {
      takeOffBoard(plane, hex)
    } else {
      delete G.leaving
      G.leaving_from = hex
    }
  },

  // 4.3: back in 5 stages.
  leave_return() {
    const plane = selectedPlaneOfTheActiveSide();
    if (!plane || G.leaving_from === undefined) return
    takeOffBoard(plane, G.leaving_from)
  },

  // 8.0.2: the plane does not come back. It is out of the game, but not destroyed.
  leave_forever() {
    const plane = selectedPlaneOfTheActiveSide();
    const from = G.leaving_from
    if (!plane || from === undefined) return
    plane.at = from
    plane.altitude = G.selected_altitude ?? altitudeOf(plane)
    plane.destroyed = true
    plane.left_board = true
    logEvent(G.active, `${plane.plane.nazwa} opuszcza planszę i nie wróci`)
    clearSelection()
  },

  move_hex(target: string) {
    if (G.selected_plane === undefined) return
    const plane = selectedPlaneOfTheActiveSide();
    const flights = flightsFor(plane!, G.board.planes, G.selected_altitude, isForced(plane!))
    if (!(target in flights)) return
    push_undo()
    const from_altitude = altitudeOf(plane!)
    const straight = flights[target].direction === plane!.direction
    plane!.at = target
    plane!.direction = flights[target].direction
    plane!.altitude = G.selected_altitude ?? from_altitude
    // 7.0.2, 7.1, 7.3.1: for the attacks in the combat phase.
    G.flights ??= {}
    G.flights[plane!.id] = {path: flights[target].path, from_altitude, altitude: plane!.altitude, straight}
    if (!G.moved) G.moved = []
    set_add(G.moved, G.selected_plane)
    clearSelection()
    collide(plane!)
  },
};
