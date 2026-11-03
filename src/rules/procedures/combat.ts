import {G, ROLES} from "../globals.js"
import {isEmpty} from "@rzymek/rally-the-troops-module/rules"
import {describeShot, resolveShot} from "../game/combat.js"
import {select_plane} from "./select_plane.js"
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide"
import {canUnjam, fireTarget, fireTargets, markShot, selectTarget, shootersOf} from "./shooters"
import {endCombat} from "./phases"

export const combat = {
  inactive: "faza walki",

  prompt() {
    const myPlanes = G.board.planes[G.active as number] ?? []

    const initiative = "Faza walki – inicjatywa: " + ROLES[G.active as number]
    if (G.confirm_done) {
      const names = shootersOf(G.active as number).map(plane => plane.plane.nazwa).join(", ")
      prompt(`${initiative} – nie strzelały jeszcze samoloty, które mogą strzelać: ${names}. Zakończyć fazę walki?`)
      button("confirm_done", true)
      button("cancel", true)
      return
    }
    prompt(initiative)
    button("done", true)

    myPlanes.forEach((plane) => {
      if (canUnjam(plane) || fireTargets(plane, G.active as number).length > 0)
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
    log(`${ROLES[G.active as number]}: ${plane.plane.nazwa} atakuje ${hit.plane.plane.nazwa}${hit.rear ? " do tyłu" : ""} [SA:${atk} odl:${hit.distance} rzut:${roll}] → ${result}`)
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
      log(`${ROLES[G.active as number]} odblokował karabiny (rzut:${roll}) – sukces`)
    } else {
      log(`${ROLES[G.active as number]} nie odblokował karabinów (rzut:${roll})`)
    }
    delete G.selected_plane
  },

  done() {
    if (!isEmpty(shootersOf(G.active as number))) {
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
