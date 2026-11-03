import {G, R_Amer, ROLES} from "../globals";
import {ALT_VERY_HIGH, altitudeOf} from "../game/altitude";
import {hexesAround} from "../game/scenarios";
import {changeSide, otherSide} from "../lifecycle/changeSide";
import {isEmpty} from "@rzymek/rally-the-troops-module/rules";
import {canUnjam, shootersOf} from "./shooters";
import {gunsReady} from "./aa_guns";
import {canAttackGround} from "./bombers";
import {nextToReturn} from "./return_planes";
import {isGameOver} from "../game/victory";

// 3.0: a movement phase (1, 4) is followed by the AA phase of the other side (2, 5).
export function endMovement() {
  changeSide()
  G.aa_fired = []
  if (!isEmpty(gunsReady())) return goto("anti_aircraft")
  endAntiAircraft()
}

// 3.0: then comes the combat phase of the side that moved (3, 6),
// 5.4: opened by the enemy firing at the planes that ended their move on its fire line.
export function endAntiAircraft() {
  delete G.selected_gun
  changeSide()
  if (!isEmpty(shootersOf(otherSide(G.active)))) {
    changeSide()
    return goto("moved_into_firelane")
  }
  startCombat()
}

export function startCombat() {
  const planes = G.board.planes[G.active]
  if (planes.some(canUnjam) || planes.some(canAttackGround) || !isEmpty(shootersOf(G.active))) {
    goto("combat")
  } else {
    endCombat()
  }
}

// 3.0: firing during the enemy's combat phase does not use up the shot in the plane's own phase.
export function endCombat() {
  delete G.selected_plane
  delete G.selected_target
  G.flights = {}
  G.bombed_now = {}
  delete G.selected_gun
  changeSide()
  if (G.active === R_Amer) {
    G.stage++
    // 6.2: the "under fire" counters come off at the end of the stage.
    for (const plane of Object.values(G.board.planes).flat()) delete plane.under_fire
    // 2.0
    log(`Etap ${G.stage}`)
  }
  G.shot = []
  enterReinforcements()
  startMovement()
}

export function startMovement() {
  if (nextToReturn()) return goto("return_planes")
  // A finished game ends once the action is complete (endingGame), so it must not skip on until then.
  if (isGameOver() || G.board.planes[G.active].some(plane => !plane.destroyed)) return goto("move_planes")
  // With no own plane on the board nothing can be moved or fired at, but AA guns may still have targets.
  log(`${ROLES[G.active]}: brak samolotów na planszy – faza ruchu pominięta`)
  startCombat()
}

// 9: an occupied entry hex gives way to the nearest free one.
function enterReinforcements() {
  const planes = G.board.planes[G.active]
  const entering = (G.reinforcements?.[G.active] ?? []).filter(it => it.stage === G.stage)
  for (const {plane, at, direction} of entering) {
    const occupied = Object.values(G.board.planes).flat()
      .filter(p => !p.destroyed && altitudeOf(p) === ALT_VERY_HIGH)
      .map(p => p.at)
    const hex = hexesAround(at, 5).find(it => !occupied.includes(it))!
    const offBoard = (G.off_board ?? []).filter(it => parseInt(it.plane.id) === G.active).length
    planes.push({plane, at: hex, direction, id: `${G.active}.${planes.length + offBoard}`})
    log(`${ROLES[G.active]}: posiłki ${plane.nazwa} na ${hex}`)
  }
  if (entering.length > 0)
    G.reinforcements![G.active] = G.reinforcements![G.active].filter(it => it.stage !== G.stage)
}
