import type {PlaneInstance} from "../types";
import {G, ROLES} from "../globals";
import {ATTACK_NAMES, AttackKind, attackDamage, bombsLeft} from "../game/bombs";
import {ALT_HIGH, ALT_LOW, ALT_LOWEST} from "../game/altitude";
import {damageShip, shipAt} from "../game/ships";
import {hexStep} from "@rzymek/rally-the-troops-module/rules";
import {bombGun, hasGun} from "./aa_guns";

// 7.3.1
const TORPEDO_RANGE = 3

// 7.1: how the plane may drop its bombs, after the way it flew in this stage.
export function bombingKind(plane: PlaneInstance): AttackKind | null {
  const flight = G.flights?.[plane.id]
  if (!flight || plane.plane.torpeda) return null
  // 7.1.1: over the hex at altitude 4 or 5, not changing it in this stage.
  if (flight.from_altitude === flight.altitude && flight.altitude >= ALT_HIGH) return "poziome"
  // 7.1.2: down two levels, from 3 to 1.
  if (plane.plane.nurkowy && flight.from_altitude === ALT_LOW && flight.altitude === ALT_LOWEST) return "nurkowe"
  return null
}

function ships() {
  return G.ships ?? []
}

function isWorthBombing(hex: string): boolean {
  return !!G.targets?.includes(hex) || hasGun(hex) || !!shipAt(ships(), hex)
}

// 7.0.1-7.0.4: the ships, strategic objects and AA guns the plane flew over in this stage and has not bombed yet.
export function bombableHexes(plane: PlaneInstance): string[] {
  if (plane.destroyed || bombsLeft(plane) <= 0 || !bombingKind(plane)) return []
  const done = G.bombed_now?.[plane.id] ?? []
  return [...new Set(G.flights![plane.id].path)].filter(hex => !done.includes(hex) && isWorthBombing(hex))
}

// 7.3.1: flying straight at the lowest altitude, at the first ship 1-3 hexes straight ahead.
export function torpedoHexes(plane: PlaneInstance): string[] {
  const flight = G.flights?.[plane.id]
  if (plane.destroyed || !plane.plane.torpeda || bombsLeft(plane) <= 0 || !flight) return []
  if (!flight.straight || flight.from_altitude !== ALT_LOWEST || flight.altitude !== ALT_LOWEST) return []
  let hex: string | null = plane.at
  for (let i = 0; i < TORPEDO_RANGE; i++) {
    hex = hexStep(hex, plane.direction)
    if (!hex) return []
    const ship = shipAt(ships(), hex)
    if (ship) return ship.hexes.filter(it => it === hex)
  }
  return []
}

export function canAttackGround(plane: PlaneInstance): boolean {
  return bombableHexes(plane).length > 0 || torpedoHexes(plane).length > 0
}

function rollAttack(plane: PlaneInstance, kind: AttackKind, hex: string): number {
  const roll = (random(6) + 1) + (random(6) + 1)
  const underFire = !!plane.under_fire
  const damage = attackDamage(kind, underFire, roll)
  const ship = shipAt(ships(), hex)
  const what = ship ? ship.nazwa : `cel ${hex}`
  const result = damage === 0 ? "bez skutku" : ship ? `uszkodzenia: ${damage} → ${damageShip(ship, damage)}` : `trafiony (uszkodzenia: ${damage})`
  log(`${ROLES[G.active]}: ${plane.plane.nazwa} – ${ATTACK_NAMES[kind]}, ${what}${underFire ? ", pod ostrzałem" : ""} [rzut:${roll}] → ${result}`)
  return damage
}

function useLoad(plane: PlaneInstance, hex: string) {
  plane.bombs_dropped = (plane.bombs_dropped ?? 0) + 1
  G.bombed_now ??= {}
  G.bombed_now[plane.id] = [...(G.bombed_now[plane.id] ?? []), hex]
}

// 7.2: a strategic object counts as bombed after a hit for at least 1 damage.
function hitTarget(hex: string) {
  G.bombed ??= []
  set_add(G.bombed, hex)
}

export function dropBomb(plane: PlaneInstance, hex: string) {
  const kind = bombingKind(plane)!
  useLoad(plane, hex)
  const isTarget = !!G.targets?.includes(hex)
  if (shipAt(ships(), hex) || isTarget) {
    const damage = rollAttack(plane, kind, hex)
    if (damage > 0 && isTarget) hitTarget(hex)
  }
  // 7.0.6
  if (hasGun(hex)) bombGun(hex)
}

export function launchTorpedo(plane: PlaneInstance, hex: string) {
  useLoad(plane, hex)
  rollAttack(plane, "torpeda", hex)
}
