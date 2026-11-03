import type {PlaneInstance} from "../types";
import {G, L, R_Jap, ROLES} from "../globals";
import {aaHitFrom, canPlaceGun, GUN_DESTROYED_FROM} from "../game/aa";
import {ALTITUDE_NAMES, altitudeOf} from "../game/altitude";
import {applyHit} from "../game/combat";
import {boardHexes} from "../game/scenarios";
import {hexDistance, isEmpty} from "@rzymek/rally-the-troops-module/rules";
import {otherSide} from "../lifecycle/changeSide";
import {endAntiAircraft} from "./phases";

function gunsLeftToPlace(): number {
  return (L.count as number) - (G.aa_guns ?? []).length
}

// 6: the British player sets up the guns before the game starts.
export const placeAaGuns = {
  inactive: "rozstawianie działek p-lot",

  prompt() {
    const left = gunsLeftToPlace()
    prompt(`Rozstaw działka p-lot – pozostało: ${left}`)
    if (left > 0)
      boardHexes().filter(hex => canPlaceGun(hex, G.aa_guns ?? [])).forEach(hex => action("place_gun", hex))
    button("done", left === 0)
  },

  place_gun(hex: string) {
    if (gunsLeftToPlace() <= 0 || !canPlaceGun(hex, G.aa_guns ?? [])) return
    push_undo()
    G.aa_guns ??= []
    set_add(G.aa_guns, hex)
  },

  done() {
    if (gunsLeftToPlace() > 0) return
    clear_undo()
    log(`${ROLES[R_Jap]}: rozstawiono działka p-lot (${G.aa_guns!.length})`)
    goto("place_planes")
  },
}

// 6.1.1: the land guns of the scenario, so far on the Japanese side only.
function gunsOf(side: number): string[] {
  return side === R_Jap ? G.aa_guns ?? [] : []
}

// 6.2: the guns of the active side fire at the planes of the other one.
export function aaTargets(gun: string): PlaneInstance[] {
  return G.board.planes[otherSide(G.active)].filter(plane => aaHitFrom(gun, plane) !== null)
}

// 6.3.1: one shot per gun in a stage.
export function gunsReady(): string[] {
  return gunsOf(G.active).filter(gun => !set_has(G.aa_fired ?? [], gun) && aaTargets(gun).length > 0)
}

export function selectGun(gun: string) {
  delete G.selected_plane
  if (G.selected_gun === gun) {
    delete G.selected_gun
  } else if (gunsReady().includes(gun)) {
    G.selected_gun = gun
  }
}

export function fireGun(planeId: string) {
  const gun = G.selected_gun
  if (gun === undefined || !gunsReady().includes(gun)) return
  const plane = aaTargets(gun).find(it => it.id === planeId)
  if (!plane) return
  clear_undo()
  G.aa_fired ??= []
  set_add(G.aa_fired, gun)
  delete G.selected_gun
  const hitFrom = aaHitFrom(gun, plane)!
  const roll = random(6) + 1
  const result = roll >= hitFrom ? applyHit(plane) : 'pudło'
  log(`Działko ${gun} ostrzeliwuje ${plane.plane.nazwa} [${ALTITUDE_NAMES[altitudeOf(plane)]}, odl:${hexDistance(gun, plane.at)}, rzut:${roll}] → ${result}`)
}

// 3.0, phases 2 and 5: right after the enemy's movement, the guns fire at its planes.
export const antiAircraft = {
  inactive: "ostrzał przeciwlotniczy",

  prompt() {
    prompt(`Ostrzał przeciwlotniczy: ${ROLES[G.active]}${G.selected_gun ? ` – działko ${G.selected_gun}, wybierz cel` : " – wybierz działko"}`)
    gunsReady().forEach(gun => action("select_gun", gun))
    if (G.selected_gun !== undefined)
      aaTargets(G.selected_gun).forEach(target => action("aa_fire", target.id))
    button("done", true)
  },

  select_gun: selectGun,

  aa_fire(planeId: string) {
    fireGun(planeId)
    if (isEmpty(gunsReady())) endAntiAircraft()
  },

  done() {
    endAntiAircraft()
  },
}

export function hasGun(hex: string): boolean {
  return (G.aa_guns ?? []).includes(hex)
}

// 7.0.6, 6.2.6
export function bombGun(hex: string) {
  const roll = random(6) + 1
  if (roll >= GUN_DESTROYED_FROM) {
    set_delete(G.aa_guns!, hex)
    log(`Działko ${hex} zbombardowane [rzut:${roll}] → zniszczone`)
  } else {
    log(`Działko ${hex} zbombardowane [rzut:${roll}] → ocalało`)
  }
}
