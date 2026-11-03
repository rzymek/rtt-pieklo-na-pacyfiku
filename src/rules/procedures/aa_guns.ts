import type {PlaneInstance} from "../types";
import {G, L, R_Jap, R_Amer, ROLES} from "../globals";
import {aaHitFrom, canPlaceGun, GUN_DESTROYED_FROM} from "../game/aa";
import {ALTITUDE_NAMES, altitudeOf} from "../game/altitude";
import {applyHit} from "../game/combat";
import {boardHexes} from "../game/scenarios";
import {hexDistance} from "@rzymek/rally-the-troops-module/rules";

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

export function aaTargets(gun: string): PlaneInstance[] {
  return G.board.planes[R_Amer].filter(plane => aaHitFrom(gun, plane) !== null)
}

// 6.1, 6.2.1: only in the British combat phase, one shot per gun.
export function gunsReady(): string[] {
  if (G.active !== R_Jap) return []
  return (G.aa_guns ?? []).filter(gun => !set_has(G.aa_fired ?? [], gun) && aaTargets(gun).length > 0)
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
