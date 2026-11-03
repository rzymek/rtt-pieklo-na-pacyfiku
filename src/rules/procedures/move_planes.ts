import {G, R_Amer, ROLES, V} from "../globals.js"
import {exitsFor, flightsFor, possibleMovesFor} from "../game/hex.js"
import {applyHit} from "../game/combat";
import {scorePlaneLost} from "../game/victory";
import {ALTITUDE_ACTIONS, ALTITUDE_NAMES, altitudeHandlers, altitudeOf, canChangeAltitude} from "../game/altitude";
import {endMovement} from "./phases";
import {select_plane} from "./select_plane.js";
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide";
import {bombableHexes, canBomb, dropBomb} from "./bombers";
import {bombsLeft} from "../game/bombs";
import {bombGun, hasGun} from "./aa_guns";
import type {PlaneInstance} from "../types";

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

// 8.1: only the Germans fly home through the south edge.
function southExit(plane: PlaneInstance): string | undefined {
  return G.active === R_Amer ? exits(plane).find(it => it.south)?.hex : undefined
}

function takeOffBoard(plane: PlaneInstance, from: string) {
  plane.at = from
  plane.altitude = G.selected_altitude ?? altitudeOf(plane)
  const side = G.active
  G.board.planes[side] = G.board.planes[side].filter(it => it !== plane)
  G.off_board ??= []
  const return_stage = G.stage + RETURN_AFTER_STAGES
  G.off_board.push({plane, return_stage, from})
  log(`${ROLES[side]}: ${plane.plane.nazwa} opuszcza planszę na ${from} – powrót w etapie ${return_stage}`)
  clearSelection()
}

function clearSelection() {
  delete G.selected_plane
  delete G.selected_altitude
  delete G.leaving
  delete G.leaving_south_from
}

// 4.3.2: the British may have caught a German plane leaving the board anywhere but in the south.
function leaveUnderFire(plane: PlaneInstance, from: string) {
  clear_undo()
  const roll = random(6) + 1
  plane.at = from
  plane.altitude = G.selected_altitude ?? altitudeOf(plane)
  if (roll === 1 || (roll === 2 && plane.damaged)) {
    plane.destroyed = true
    log(`${ROLES[G.active]}: ${plane.plane.nazwa} opuszcza planszę na ${from} [rzut:${roll}] → zestrzelony`)
    scorePlaneLost(plane)
    clearSelection()
    return
  }
  log(`${ROLES[G.active]}: ${plane.plane.nazwa} opuszcza planszę na ${from} [rzut:${roll}] → ${roll === 2 ? applyHit(plane) : "bez strat"}`)
  takeOffBoard(plane, from)
}

// 4.2.6
function collide(plane: PlaneInstance) {
  const others = Object.values(G.board.planes).flat()
    .filter(it => it !== plane && !it.destroyed && it.at === plane.at && altitudeOf(it) === altitudeOf(plane))
  if (others.length === 0) return
  clear_undo()
  const roll = random(6) + 1
  if (roll !== COLLISION_ROLL) {
    log(`${plane.plane.nazwa} wlatuje na zajęty heks ${plane.at} [rzut:${roll}] → bez kolizji`)
    return
  }
  log(`${plane.plane.nazwa} wlatuje na zajęty heks ${plane.at} [rzut:${roll}] → zderzenie`)
  for (const it of [plane, ...others]) {
    it.destroyed = true
    scorePlaneLost(it, {shotDown: false})
  }
}

function hasMoved(plane: PlaneInstance): boolean {
  return set_has(G.moved ?? [], plane.id)
}

function selectablePlanes(): PlaneInstance[] {
  return G.board.planes[G.active].filter(plane => !plane.destroyed && (!hasMoved(plane) || canBomb(plane)))
}

export const movePlanes = {
  inactive: "faza ruchu samolotów",

  prompt() {
    const selected = selectedPlaneOfTheActiveSide();
    if (selected !== undefined && hasMoved(selected)) {
      prompt(`${selected.plane.nazwa} – możesz zrzucić bomby na cel, nad którym przeleciał (pozostało serii: ${bombsLeft(selected)})`)
      bombableHexes(selected).forEach(hex => action("bomb", hex))
      selectablePlanes().forEach(plane => action("select_plane", plane.id))
      // Counters on the hexes to bomb pass their clicks through, this plane's own included.
      button("deselect", true)
      button("done", (V!.unmoved ?? []).length === 0)
      return
    }
    if (selected !== undefined && G.leaving_south_from !== undefined) {
      prompt(`${selected.plane.nazwa} opuszcza planszę przez południową krawędź – czy wróci do gry?`)
      button("leave_return")
      button("leave_forever")
      return
    }
    if (selected !== undefined && G.leaving) {
      prompt(`${selected.plane.nazwa} – wybierz heks, przez który opuści planszę`)
      exits(selected).forEach(({hex}) => action("leave_hex", hex))
      // 8.1: a plane that is not coming back does not care which south hex it leaves through.
      if (southExit(selected) !== undefined) button("leave_forever")
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
    button("done", (V!.unmoved ?? []).length === 0)
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
    // Undo back into the movement phase stays possible until a die is rolled in combat
    // (the framework drops it anyway when the turn passes to the other side).
    push_undo()
    G.moved = []
    G.flown_over = {}
    delete G.selected_plane
    endMovement()
  },

  select_plane,

  deselect() {
    delete G.selected_plane
  },

  bomb(hex: string) {
    const plane = selectedPlaneOfTheActiveSide()
    if (!plane || !bombableHexes(plane).includes(hex)) return

    // A die roll for a gun cannot be taken back.
    const gun = hasGun(hex)
    if (gun) clear_undo()
    else push_undo()
    log(`${ROLES[G.active]} zrzuca bomby na ${hex} (pozostało serii: ${bombsLeft(plane) - 1})`)
    dropBomb(plane, hex)
    if (gun) bombGun(hex)
    if (!canBomb(plane)) delete G.selected_plane
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
    if (G.active !== R_Amer) {
      push_undo()
      takeOffBoard(plane, hex)
    } else if (exit.south) {
      push_undo()
      delete G.leaving
      G.leaving_south_from = hex
    } else {
      leaveUnderFire(plane, hex)
    }
  },

  // 8.1, 4.3.2: the south edge is the safe way home: no die roll.
  leave_return() {
    const plane = selectedPlaneOfTheActiveSide();
    if (!plane || G.leaving_south_from === undefined) return
    takeOffBoard(plane, G.leaving_south_from)
  },

  // 8.1: the plane does not come back. It is out of the game, but the enemy gets no points for it.
  leave_forever() {
    const plane = selectedPlaneOfTheActiveSide();
    const from = plane && (G.leaving_south_from ?? (G.leaving ? southExit(plane) : undefined))
    if (!plane || from === undefined) return
    if (G.leaving_south_from === undefined) push_undo()
    plane.at = from
    plane.altitude = G.selected_altitude ?? altitudeOf(plane)
    plane.destroyed = true
    plane.left_board = true
    log(`${ROLES[G.active]}: ${plane.plane.nazwa} opuszcza planszę i nie wróci`)
    clearSelection()
  },

  move_hex(target: string) {
    if (G.selected_plane === undefined) return
    const plane = selectedPlaneOfTheActiveSide();
    const flights = flightsFor(plane!, G.board.planes, G.selected_altitude, isForced(plane!))
    if (!(target in flights)) return
    push_undo()
    plane!.at = target
    plane!.direction = flights[target].direction
    plane!.altitude = G.selected_altitude ?? altitudeOf(plane!)
    G.flown_over ??= {}
    G.flown_over[plane!.id] = flights[target].path
    if (!G.moved) G.moved = []
    set_add(G.moved, G.selected_plane)
    clearSelection()
    collide(plane!)
    // 3.0: straight on to the bombs dropped along the way.
    if (canBomb(plane!)) G.selected_plane = plane!.id
  },
};
