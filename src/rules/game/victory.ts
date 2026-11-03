import type {PlaneInstance} from "../types";
import {G, R_Jap, R_Amer, ROLES} from "../globals";
import {otherSide} from "../lifecycle/changeSide";

// Table 1
const VP_BOMB_ON_TARGET = 3
const VP_FIGHTER_SHOT_DOWN = 2
const VP_BOMBER_SHOT_DOWN = 4
const VP_FIGHTER_LOST = -1
const VP_BOMBER_LOST = -2

// 8.0: the score can go below zero.
function addVp(side: number, points: number, reason: string) {
  G.vp ??= {[R_Amer]: 0, [R_Jap]: 0}
  G.vp[side] += points
  log(`${ROLES[side]}: ${points > 0 ? "+" : ""}${points} PZ (${reason}) → ${G.vp[side]} PZ`)
}

// Table 1: the Me-110 carries bombs, but counts as a fighter.
// 4.2.6: nobody shot down a plane lost in a collision, so only its owner's score changes.
export function scorePlaneLost(plane: PlaneInstance, {shotDown = true} = {}) {
  const name = plane.plane.nazwa
  const side = parseInt(plane.id)
  const bomber = !!plane.plane.udzwig_bomb
  addVp(side, bomber ? VP_BOMBER_LOST : VP_FIGHTER_LOST, `stracony ${name}`)
  if (shotDown) addVp(otherSide(side), bomber ? VP_BOMBER_SHOT_DOWN : VP_FIGHTER_SHOT_DOWN, `zestrzelony ${name}`)
}

export function scoreBombOnTarget(hex: string) {
  addVp(R_Amer, VP_BOMB_ON_TARGET, `bomby na ${hex}`)
}

// 9.2
export function scoreAllTargetsBombed() {
  if (G.all_targets_vp) addVp(R_Amer, G.all_targets_vp, "zbombardowane wszystkie cele")
}

// 8.1: planes yet to come count as well, or a side could lose before they enter.
function hasUnitsLeft(side: number): boolean {
  return G.board.planes[side].some(plane => !plane.destroyed)
    || (G.to_place?.[side] ?? []).length > 0
    || (G.off_board ?? []).some(it => parseInt(it.plane.id) === side)
    || (G.reinforcements?.[side] ?? []).length > 0
    || (side === R_Jap && (G.aa_guns ?? []).length > 0)
}

export function isGameOver(): boolean {
  return !hasUnitsLeft(R_Amer) || !hasUnitsLeft(R_Jap)
}

// 8.2: the fewest points missing, then the larger percentage of the required points. null = a draw.
// The manual does not say what happens when both sides reach their minimum: the same comparison decides.
export function winner(vp: Record<number, number>, min: Record<number, number>): number | null {
  const missing = (side: number) => min[side] - vp[side]
  // Cross-multiplied percentages, to stay away from comparing floats.
  const compared = missing(R_Jap) - missing(R_Amer) || vp[R_Amer] * min[R_Jap] - vp[R_Jap] * min[R_Amer]
  return compared > 0 ? R_Amer : compared < 0 ? R_Jap : null
}

function endGame() {
  const vp = G.vp!, min = G.min_vp!
  const score = [R_Amer, R_Jap].map(side => `${ROLES[side]} ${vp[side]}/${min[side]} PZ`).join(", ")
  const side = winner(vp, min)
  delete G.selected_plane
  delete G.selected_altitude
  delete G.selected_gun
  if (side === null) {
    finish("Draw", `Remis: ${score}`)
  } else {
    const kind = vp[side] >= min[side] ? "pełne" : "minimalne"
    finish(side, `Wygrywają ${ROLES[side]} (${kind} zwycięstwo): ${score}`)
  }
}

export function checkGameEnd() {
  if (isGameOver()) endGame()
}

// Checked once an action is complete: simultaneous hits (5.4) must all be applied by then.
export function endingGame<T extends object>(state: T): T {
  return Object.fromEntries(Object.entries(state).map(([name, handler]) => [
    name,
    typeof handler === "function" && name !== "prompt"
      ? (argument: unknown) => {
        handler(argument)
        checkGameEnd()
      }
      : handler,
  ])) as T
}
