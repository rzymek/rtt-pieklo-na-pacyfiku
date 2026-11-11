import {G, ROLES} from "../globals.js"
import {isEmpty} from "@rzymek/rally-the-troops-module/rules"
import {describeShot, resolveShot} from "../game/combat.js"
import {select_plane} from "./select_plane.js"
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide"
import {canUnjam, fireTarget, fireTargets, markShot, selectTarget} from "./shooters"
import {endCombat} from "./phases"
import {bombableHexes, bombingKind, canAttackGround, dropBomb, launchTorpedo, torpedoHexes} from "./bombers"
import {ATTACK_NAMES} from "../game/bombs"
import type {PlaneInstance} from "../types"
import {logAttack, shotDice} from "./log"

// Planes that could still fire, drop bombs or launch a torpedo.
function stillActive(side: number): PlaneInstance[] {
  return G.board.planes[side].filter(plane => fireTargets(plane, side).length > 0 || canAttackGround(plane))
}

export const combat = {
  inactive: "faza walki",

  prompt() {
    const myPlanes = G.board.planes[G.active as number] ?? []

    const initiative = "Faza walki – inicjatywa: " + ROLES[G.active as number]
    if (G.confirm_done) {
      const names = stillActive(G.active as number).map(plane => plane.plane.nazwa).join(", ")
      prompt(`${initiative} – nie wykorzystały jeszcze ataku samoloty: ${names}. Zakończyć fazę walki?`)
      button("confirm_done", true)
      button("cancel", true)
      return
    }
    prompt(initiative)
    button("done", true)

    myPlanes.forEach((plane) => {
      if (canUnjam(plane) || fireTargets(plane, G.active as number).length > 0 || canAttackGround(plane))
        action("select_plane", plane.id)
    })

    const plane = selectedPlaneOfTheActiveSide()
    if (plane && canUnjam(plane)) {
      button("unjam", true)
    } else if (plane) {
      const hit = fireTarget(plane, G.active as number)
      if (hit) {
        prompt(`${initiative} – ${describeShot(plane, hit)}`)
        button("attack", true)
        const targets = fireTargets(plane, G.active as number)
        if (targets.length > 1) targets.forEach(it => action("target", it.plane.id))
      }
    }
    // 7.0.3: bombs and torpedoes fall in the attack phase.
    if (plane) {
      const bombs = bombableHexes(plane), torpedoes = torpedoHexes(plane)
      bombs.forEach(hex => action("bomb", hex))
      torpedoes.forEach(hex => action("torpedo", hex))
      if (bombs.length > 0 || torpedoes.length > 0) {
        const kind = torpedoes.length > 0 ? ATTACK_NAMES.torpeda : ATTACK_NAMES[bombingKind(plane)!]
        prompt(`${initiative} – ${plane.plane.nazwa}: ${kind}, wybierz heks (pozostało: ${(plane.plane.udzwig_bomb ?? 0) - (plane.bombs_dropped ?? 0)})`)
      }
    }
  },

  bomb(hex: string) {
    const plane = selectedPlaneOfTheActiveSide()
    if (!plane || !bombableHexes(plane).includes(hex)) return
    clear_undo()
    dropBomb(plane, hex)
    if (!canAttackGround(plane) && fireTargets(plane, G.active as number).length === 0) delete G.selected_plane
  },

  torpedo(hex: string) {
    const plane = selectedPlaneOfTheActiveSide()
    if (!plane || !torpedoHexes(plane).includes(hex)) return
    clear_undo()
    launchTorpedo(plane, hex)
    if (fireTargets(plane, G.active as number).length === 0) delete G.selected_plane
  },

  select_plane,

  target(planeId: string) {
    selectTarget(selectedPlaneOfTheActiveSide(), G.active as number, planeId)
  },

  attack() {
    const plane = selectedPlaneOfTheActiveSide()
    const hit = plane && fireTarget(plane, G.active as number)
    if (!plane || !hit) return

    clear_undo()
    markShot(plane)
    const {roll, atk, result} = resolveShot(plane, hit)
    logAttack(G.active as number, `${plane.plane.nazwa} atakuje ${hit.plane.plane.nazwa}${hit.rear ? " do tyłu" : ""}`, shotDice(atk, hit.distance, roll), result)
    delete G.selected_plane
    delete G.selected_target
  },

  unjam() {
    const plane = selectedPlaneOfTheActiveSide()
    if (!plane || !canUnjam(plane)) return
    clear_undo()
    markShot(plane)
    const roll = random(6) + 1
    if (roll === 6) {
      delete plane.jammed
      // 5.3.4
      plane.unjammed_stage = G.stage
      logAttack(G.active as number, `${plane.plane.nazwa} odblokowuje karabiny`, `rzut ${roll}`, "sukces")
    } else {
      logAttack(G.active as number, `${plane.plane.nazwa} odblokowuje karabiny`, `rzut ${roll}`, "bez skutku")
    }
    delete G.selected_plane
  },

  done() {
    if (!isEmpty(stillActive(G.active as number))) {
      push_undo()
      G.confirm_done = true
      return
    }
    endCombat()
  },

  confirm_done() {
    delete G.confirm_done
    endCombat()
  },

  cancel() {
    delete G.confirm_done
  },
};
