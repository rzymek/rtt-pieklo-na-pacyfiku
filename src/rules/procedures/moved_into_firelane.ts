import type {PlaneInstance} from "../types";
import {G, L, ROLES} from "../globals";
import {applyHit, applyShot, describeShot, resolveShot, rollShot} from "../game/combat";
import {changeSide, otherSide} from "../lifecycle/changeSide";
import {logAttack, logOutcome, shotDice} from "./log";
import {isEmpty} from "@rzymek/rally-the-troops-module/rules";
import {select_plane} from "./select_plane";
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide";
import {fireTarget, fireTargets, markShot, selectTarget, shootersOf} from "./shooters";
import {startCombat} from "./phases";

function endReaction() {
  delete G.selected_plane
  changeSide()
  startCombat()
}

function afterShot() {
  delete G.selected_plane
  delete G.selected_target
  clear_undo()
  if (isEmpty(shootersOf(G.active))) endReaction()
}

function planeById(id: unknown): PlaneInstance {
  return Object.values(G.board.planes).flat().find(plane => plane.id === id)!
}

// 5.4: before the moving side's own attacks, enemy planes fire at those that ended their move on their fire line.
export const movedIntoFirelane = {
  inactive: "krzyżowanie się linii ognia",

  prompt() {
    shootersOf(G.active).forEach(plane => action("select_plane", plane.id))
    const selected = selectedPlaneOfTheActiveSide()
    const hit = selected && fireTarget(selected, G.active)
    const title = `krzyżowanie się linii ognia – ostrzał ${ROLES[G.active]}`
    prompt(hit ? `${title} – ${describeShot(selected, hit)}` : title)
    button("attack", !!hit)
    const targets = selected ? fireTargets(selected, G.active) : []
    if (targets.length > 1) targets.forEach(it => action("target", it.plane.id))
    button("done")
  },

  select_plane,

  target(planeId: string) {
    selectTarget(selectedPlaneOfTheActiveSide(), G.active, planeId)
  },

  attack() {
    const plane = selectedPlaneOfTheActiveSide()
    const hit = plane && fireTarget(plane, G.active)
    if (!plane || !hit) return
    markShot(plane)
    const shot = rollShot(plane, hit.plane, hit.distance, hit.rear)
    logAttack(G.active, `${plane.plane.nazwa} atakuje ${hit.plane.plane.nazwa}${hit.rear ? " do tyłu" : ""} (linia ognia)`, shotDice(shot.atk, hit.distance, shot.roll), shot.result)
    if (shot.damage === 0) return afterShot()
    if (fireTargets(hit.plane, hit.side).some(it => it.plane.id === plane.id)) {
      // Coinciding fire lines: the target shoots back before this hit takes effect.
      delete G.selected_plane
      delete G.selected_target
      changeSide()
      G.selected_plane = hit.plane.id
      clear_undo()
      return goto("return_fire", {shooter: plane.id, target: hit.plane.id, damage: shot.damage, downed: shot.downed})
    }
    logOutcome(G.active, hit.plane.plane.nazwa, applyShot(hit.plane, shot))
    afterShot()
  },

  done() {
    endReaction()
  },
}

function endReturnFire() {
  const target = planeById(L.target)
  logOutcome(otherSide(G.active), target.plane.nazwa, applyHit(target, L.damage as number, L.downed as boolean))
  changeSide()
  goto("moved_into_firelane")
  afterShot()
}

// 5.4: the hit plane fires back at its attacker.
function returnFireTarget(plane: PlaneInstance) {
  return fireTargets(plane, G.active).find(it => it.plane.id === L.shooter)
}

export const returnFire = {
  inactive: "równoczesny ostrzał",

  prompt() {
    const plane = planeById(L.target)
    const hit = returnFireTarget(plane)
    const title = `Samolot ${ROLES[G.active]} został trafiony – może jeszcze odpowiedzieć ogniem`
    prompt(hit ? `${title} – ${describeShot(plane, hit)}` : title)
    button("attack")
    button("done")
  },

  attack() {
    const plane = planeById(L.target)
    const hit = returnFireTarget(plane)
    if (hit) {
      markShot(plane)
      const {roll, atk, result} = resolveShot(plane, hit)
      logAttack(G.active, `${plane.plane.nazwa} odpowiada ogniem${hit.rear ? " do tyłu" : ""}`, shotDice(atk, hit.distance, roll), result)
    }
    endReturnFire()
  },

  done() {
    endReturnFire()
  },
}
