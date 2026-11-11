import type {PlaneInstance} from "../types";
import {G, L, R_Jap, ROLES} from "../globals";
import {shipGunCount, type Ship} from "../game/ships";
import {AaGun, aaShot, canFireAt, canPlaceGun, describeAaShot, GUN_DESTROYED_FROM} from "../game/aa";
import {ALTITUDE_NAMES, altitudeOf} from "../game/altitude";
import {applyHit} from "../game/combat";
import {boardHexes} from "../game/scenarios";
import {isEmpty} from "@rzymek/rally-the-troops-module/rules";
import {otherSide} from "../lifecycle/changeSide";
import {endAntiAircraft} from "./phases";
import {logAttack, logEvent} from "./log";

function landGuns() {
  return G.aa_guns ?? []
}

function gunsLeftToPlace(): number {
  return (L.count as number) - landGuns().filter(it => it.side === G.active).length
}

const caliber = (heavy: boolean) => heavy ? "ciężkie" : "lekkie"

// 6.1.1: the scenario's land guns are set up by their side before the game starts.
export const placeAaGuns = {
  inactive: "rozstawianie działek p-lot",

  prompt() {
    const left = gunsLeftToPlace()
    prompt(`Rozstaw ${caliber(L.heavy as boolean)} działka p-lot na wyspie – pozostało: ${left}`)
    if (left > 0)
      boardHexes().filter(hex => canPlaceGun(hex, landGuns())).forEach(hex => action("place_gun", hex))
    button("done", left === 0)
  },

  place_gun(hex: string) {
    if (gunsLeftToPlace() <= 0 || !canPlaceGun(hex, landGuns())) return
    push_undo()
    G.aa_guns ??= []
    G.aa_guns.push({hex, side: G.active, heavy: L.heavy as boolean})
  },

  done() {
    if (gunsLeftToPlace() > 0) return
    clear_undo()
    logEvent(G.active, `${ROLES[G.active]}: rozstawiono działka p-lot (${L.count})`)
    // 9.3: the Japanese set up their planes first.
    G.active = R_Jap
    goto("place_planes")
  },
}

// 6.1.3: the guns of a ship, numbered heavy first: "<ship id>/C1", "<ship id>/L1".
function shipGuns(ship: Ship): AaGun[] {
  const {light, heavy} = shipGunCount(ship)
  const guns = (count: number, isHeavy: boolean) => Array.from({length: count}, (_, i) =>
    ({id: `${ship.id}/${isHeavy ? "C" : "L"}${i + 1}`, label: `${ship.nazwa} (${i + 1})`, side: ship.side, heavy: isHeavy, hexes: ship.hexes}))
  return [...guns(heavy, true), ...guns(light, false)]
}

// 6.1.1, 6.1.3: the land guns and the ship guns of the side.
export function gunsOf(side: number): AaGun[] {
  return [
    ...landGuns().filter(it => it.side === side).map(({hex, heavy}) => ({id: hex, label: hex, side, heavy, hexes: [hex]})),
    ...(G.ships ?? []).filter(ship => ship.side === side).flatMap(shipGuns),
  ]
}

function gunById(id: string | undefined): AaGun | undefined {
  return gunsOf(G.active).find(it => it.id === id)
}

// 6.2: the guns of the active side fire at the planes of the other one.
export function aaTargets(gun: AaGun): PlaneInstance[] {
  return G.board.planes[otherSide(G.active)].filter(plane => canFireAt(gun, plane))
}

// 6.3.1: one shot per gun in a stage.
export function gunsReady(): AaGun[] {
  return gunsOf(G.active).filter(gun => !set_has(G.aa_fired ?? [], gun.id) && aaTargets(gun).length > 0)
}

export function selectGun(id: string) {
  delete G.selected_plane
  if (G.selected_gun === id) {
    delete G.selected_gun
  } else if (gunsReady().some(it => it.id === id)) {
    G.selected_gun = id
  }
}

export function fireGun(planeId: string) {
  const gun = gunById(G.selected_gun)
  if (!gun || !gunsReady().some(it => it.id === gun.id)) return
  const plane = aaTargets(gun).find(it => it.id === planeId)
  if (!plane) return
  clear_undo()
  G.aa_fired ??= []
  set_add(G.aa_fired, gun.id)
  delete G.selected_gun
  const roll = (random(6) + 1) + (random(6) + 1)
  const description = describeAaShot(gun, plane)
  const shot = aaShot(gun, plane, roll)
  if (shot.underFire) plane.under_fire = true
  const result = shot.damage > 0 ? `trafienie → ${applyHit(plane, shot.damage)}` : shot.underFire ? "pod ostrzałem" : "pudło"
  logAttack(G.active, `Działko ${caliber(gun.heavy)} ${gun.label} ostrzeliwuje ${description}`, `${ALTITUDE_NAMES[altitudeOf(plane)]} · rzut ${roll}`, result)
}

// 3.0, phases 2 and 5: right after the enemy's movement, the guns fire at its planes.
export const antiAircraft = {
  inactive: "ostrzał przeciwlotniczy",

  prompt() {
    const gun = gunById(G.selected_gun)
    const targets = gun ? aaTargets(gun) : []
    prompt(`Ostrzał przeciwlotniczy: ${ROLES[G.active]}${gun
      ? ` – działko ${caliber(gun.heavy)} ${gun.label}, wybierz cel: ${targets.map(it => describeAaShot(gun, it)).join("; ")}`
      : " – wybierz działko"}`)
    gunsReady().forEach(it => action("select_gun", it.id))
    targets.forEach(target => action("aa_fire", target.id))
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
  return landGuns().some(it => it.hex === hex)
}

// 7.0.6, 6.3.6
export function bombGun(hex: string) {
  const roll = random(6) + 1
  if (roll >= GUN_DESTROYED_FROM) {
    G.aa_guns = landGuns().filter(it => it.hex !== hex)
    logAttack(null, `Działko ${hex} zbombardowane`, `rzut ${roll}`, "zniszczone")
  } else {
    logAttack(null, `Działko ${hex} zbombardowane`, `rzut ${roll}`, "ocalało")
  }
}
