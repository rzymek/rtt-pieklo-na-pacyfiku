import {G, ROLES} from "../globals.js"
import {isEmpty} from "@rzymek/rally-the-troops-module/rules"
import {describeShot, resolveShot} from "../game/combat.js"
import {select_plane} from "./select_plane.js"
import {selectedPlaneOfTheActiveSide} from "./selectedPlaneOfTheActiveSide"
import {canUnjam, fireTarget, markShot, shootersOf} from "./shooters"
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
      if (canUnjam(plane) || fireTarget(plane, G.active as number))
        action("select_plane", plane.id)
    })

    const plane = selectedPlaneOfTheActiveSide()
    if (plane && canUnjam(plane)) {
      button("unjam", true)
    } else if (plane) {
      const hit = fireTarget(plane, G.active as number)
      if (hit) {
        prompt(`${initiative} – ${describeShot(plane, hit.plane, hit.distance)}`)
        button("attack", true)
      }
    }
  },

  select_plane,

  attack() {
    const plane = selectedPlaneOfTheActiveSide()
    const hit = plane && fireTarget(plane, G.active as number)
    if (!plane || !hit) return

    clear_undo()
    markShot(plane)
    const targetPlane = G.board.planes[hit.side][hit.idx]
    const {roll, atk, result} = resolveShot(plane, targetPlane!, hit.distance)
    log(`${ROLES[G.active as number]} atakuje [SA:${atk} odl:${hit.distance} rzut:${roll}] → ${result}`)
    delete G.selected_plane
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
