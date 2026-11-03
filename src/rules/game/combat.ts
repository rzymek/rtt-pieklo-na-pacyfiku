import type {PlaneInstance, Board} from "../types.js"
import {hexStep} from "@rzymek/rally-the-troops-module/rules"
import {altitudeOf, planeStats} from "./altitude.js"
import {cloudPenalty, isInCloud} from "./clouds.js"
import {sunPenalty} from "./sun.js"
import {scorePlaneLost} from "./victory.js"

type Range = [number, number] | null
const R = (from: number, to = from): Range => [from, to]
const NONE: Range[] = [null, null, null]

// Table 1: [attack strength][distance - 1] = the rolls of 2d6 giving 1, 2 and 3 damage; null = none.
// A roll of 2 or 12 always jams the guns instead (5.3.4).
export const COMBAT_TABLE: Range[][][] = [
  [NONE, NONE, NONE, NONE, NONE],
  [[R(9, 10), R(11), null], [R(10, 11), null, null], [R(11), null, null], NONE, NONE],
  [[R(8, 9), R(10, 11), null], [R(9, 10), R(11), null], [R(10, 11), null, null], [R(11), null, null], NONE],
  [[R(7, 8), R(9, 10), R(11)], [R(8, 9), R(10, 11), null], [R(9, 10), R(11), null], [R(10, 11), null, null], [R(11), null, null]],
  [[R(6, 7), R(8, 9), R(10, 11)], [R(7, 8), R(9, 10), R(11)], [R(8, 9), R(10, 11), null], [R(9, 10), R(11), null], [R(10, 11), null, null]],
  [[R(5, 6), R(7, 8), R(9, 11)], [R(6, 7), R(8, 9), R(10, 11)], [R(7, 8), R(9, 10), R(11)], [R(8, 9), R(10, 11), null], [R(9, 10), R(11), null]],
]

const FIRE_RANGE = 5

export interface FireLine {
  // 5.0.6: firing to the rear, with the second attack strength.
  rear: boolean
  hexes: string[]
}

function line(from: string, direction: number, range: number): string[] {
  const hexes: string[] = []
  let pos: string | null = from
  for (let i = 0; i < range; i++) {
    pos = hexStep(pos, direction)
    if (!pos) break
    hexes.push(pos)
  }
  return hexes
}

// 5.1, fig. 3 and 4: 5 hexes ahead; with a rear attack strength also 5 hexes straight back and along both rear diagonals.
// 5.1.1: 1 hex from a cloud. A line with an attack strength of 0 cannot hit anything.
export function fireLines(plane: PlaneInstance): FireLine[] {
  const stats = planeStats(plane)
  const range = isInCloud(plane) ? 1 : FIRE_RANGE
  const lines: FireLine[] = []
  if (stats.sila_ataku > 0) lines.push({rear: false, hexes: line(plane.at, plane.direction, range)})
  if (stats.sila_ataku_tyl > 0) {
    for (const turn of [2, 3, 4]) lines.push({rear: true, hexes: line(plane.at, (plane.direction + turn) % 6, range)})
  }
  return lines
}

export function fireLineHexes(plane: PlaneInstance): string[] {
  return fireLines(plane).flatMap(it => it.hexes)
}

export interface FireTarget {
  side: number
  idx: number
  plane: PlaneInstance
  distance: number
  rear: boolean
}

// 5.2, 5.3.2: the first plane on each fire line, at the attacker's altitude; any plane, friendly or enemy, blocks the line.
export function targetsOnFireLines(attackerPlane: PlaneInstance, allPlanes: Board['planes']): FireTarget[] {
  const byHex: Record<string, { side: number, idx: number, plane: PlaneInstance }> = {}
  for (const [sideStr, sidePlanes] of Object.entries(allPlanes)) {
    const side = parseInt(sideStr)
    sidePlanes.forEach((p, idx) => {
      if (p && !p.destroyed && altitudeOf(p) === altitudeOf(attackerPlane)) byHex[p.at] = {side, idx, plane: p}
    })
  }
  return fireLines(attackerPlane).flatMap(({rear, hexes}) => {
    const d = hexes.findIndex(hex => hex in byHex)
    return d < 0 ? [] : [{...byHex[hexes[d]], distance: d + 1, rear}]
  })
}

// The nearest plane on the fire lines.
export function firstOnFireLine(attackerPlane: PlaneInstance, allPlanes: Board['planes']): FireTarget | null {
  return targetsOnFireLines(attackerPlane, allPlanes).sort((a, b) => a.distance - b.distance)[0] ?? null
}

export interface ShotResult {
  roll: number
  atk: number
  result: string
}

export interface ShotRoll extends ShotResult {
  damage: number
  // 5.3.3: a 1 on either die of a damaging roll shoots the target down.
  downed: boolean
}

function strengthOf(attackerPlane: PlaneInstance, rear: boolean): number {
  const stats = planeStats(attackerPlane)
  return rear ? stats.sila_ataku_tyl : stats.sila_ataku
}

// 5.0.1, 5.0.2, 5.0.5
function attackStrength(attackerPlane: PlaneInstance, targetPlane: PlaneInstance, rear: boolean): number {
  return Math.max(0, strengthOf(attackerPlane, rear) - cloudPenalty(attackerPlane) - cloudPenalty(targetPlane) - sunPenalty(attackerPlane, targetPlane, rear))
}

function cell(atk: number, distance: number): Range[] {
  return COMBAT_TABLE[Math.min(atk, COMBAT_TABLE.length - 1)][distance - 1] ?? NONE
}

// 5.2: the number of damage points the roll gives.
export function damageFor(atk: number, distance: number, roll: number): number {
  return cell(atk, distance).findIndex(range => !!range && roll >= range[0] && roll <= range[1]) + 1
}

const isJam = (roll: number) => roll === 2 || roll === 12

// Rolls a shot without touching the target, so that hits can be applied simultaneously (5.4).
export function rollShot(attackerPlane: PlaneInstance, targetPlane: PlaneInstance, distance: number, rear = false): ShotRoll {
  const atk = attackStrength(attackerPlane, targetPlane, rear)
  const d1 = random(6) + 1, d2 = random(6) + 1
  const roll = d1 + d2

  if (isJam(roll)) {
    attackerPlane.jammed = true
    return {roll, atk, damage: 0, downed: false, result: 'zacięcie karabinów'}
  }

  const damage = damageFor(atk, distance, roll)
  const downed = damage > 0 && (d1 === 1 || d2 === 1)
  return {roll, atk, damage, downed, result: downed ? 'trafienie, jedynka na kości' : damage > 0 ? `uszkodzenia: ${damage}` : 'pudło'}
}

// The number of the 36 outcomes of 2d6 that sum up to a value matching the predicate.
function waysToRoll(matches: (roll: number) => boolean): number {
  let ways = 0
  for (let d1 = 1; d1 <= 6; d1++)
    for (let d2 = 1; d2 <= 6; d2++)
      if (matches(d1 + d2)) ways++
  return ways
}

export function hitChance(atk: number, distance: number): number {
  return waysToRoll(roll => !isJam(roll) && damageFor(atk, distance, roll) > 0) / 36
}

const percent = (chance: number) => `${Math.round(chance * 100)}%`

// All that makes up the odds of a shot, for the player about to fire it.
export function describeShot(attackerPlane: PlaneInstance, target: FireTarget): string {
  const {plane: targetPlane, distance, rear} = target
  const modifiers: [string, number][] = [
    ["chmura atakującego", cloudPenalty(attackerPlane)],
    ["chmura celu", cloudPenalty(targetPlane)],
    ["słońce", sunPenalty(attackerPlane, targetPlane, rear)],
  ]
  const base = strengthOf(attackerPlane, rear)
  const atk = attackStrength(attackerPlane, targetPlane, rear)
  const applied = modifiers.filter(([, value]) => value > 0).map(([name, value]) => `${name} −${value}`)
  const strength = [`SA ${rear ? "do tyłu " : ""}${base}${attackerPlane.damaged ? " (uszkodzony)" : ""}`, ...applied].join(", ")
  const total = applied.length > 0 ? ` = SA ${atk}` : ""
  const rolls = cell(atk, distance).map((range, i) => range && `${range[0] === range[1] ? range[0] : `${range[0]}–${range[1]}`}: ${i + 1}`)
    .filter(it => it).join(", ")
  return `${targetPlane.plane.nazwa}, ${strength}${total}, odległość ${distance}: ${rolls ? `rzut ${rolls} uszk.` : "bez szans"} – trafienie ${percent(hitChance(atk, distance))}, zacięcie ${percent(waysToRoll(isJam) / 36)}`
}

// 2.2: the counter turns over once the damage reaches half the endurance; the plane is shot down when it uses all of it.
export function applyHit(targetPlane: PlaneInstance, damage: number, downed = false): string {
  const endurance = targetPlane.plane.wytrzymalosc
  targetPlane.damage = Math.min(endurance, (targetPlane.damage ?? 0) + damage)
  if (downed || targetPlane.damage >= endurance) {
    targetPlane.damage = endurance
    targetPlane.destroyed = true
    scorePlaneLost(targetPlane)
    return 'zestrzelony'
  }
  const left = `pozostała wytrzymałość ${endurance - targetPlane.damage}/${endurance}`
  if (!targetPlane.damaged && targetPlane.damage * 2 >= endurance) {
    targetPlane.damaged = true
    return `poważnie uszkodzony, ${left}`
  }
  return `uszkodzony, ${left}`
}

export function applyShot(targetPlane: PlaneInstance, shot: ShotRoll): string {
  return shot.damage > 0 ? applyHit(targetPlane, shot.damage, shot.downed) : shot.result
}

export function resolveShot(attackerPlane: PlaneInstance, target: FireTarget): ShotResult {
  const shot = rollShot(attackerPlane, target.plane, target.distance, target.rear)
  return {...shot, result: shot.damage > 0 ? `${shot.result} → ${applyShot(target.plane, shot)}` : shot.result}
}
