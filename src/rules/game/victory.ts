import {G, R_Amer, R_Jap} from "../globals";
import {SCENARIOS} from "./scenarios";
import {NO_WINNER, Outcome, Tally} from "./outcomes";
import {shipType} from "./ships";

// The losing side in the genitive: "zwycięstwo Amerykanów".
const OF_SIDE = ["Amerykanów", "Japończyków"]

// Planes shot down, or lost otherwise, but not those that left the board for good (8.0.2).
export function planesLost(side: number): number {
  return G.board.planes[side].filter(plane => plane.destroyed && !plane.left_board).length
}

export function tally(): Tally {
  return {
    lost: {[R_Amer]: planesLost(R_Amer), [R_Jap]: planesLost(R_Jap)},
    bombed: (G.bombed ?? []).length,
    ships: G.ships ?? [],
  }
}

// 8.0.1: the outcome if the game ended now.
export function currentOutcome(): Outcome {
  const scenario = G.scenario === undefined ? undefined : SCENARIOS[G.scenario]
  return scenario ? scenario.victory(tally()) : NO_WINNER
}

export function describeOutcome({winner, decisive}: Outcome): string {
  if (winner === null) return "Brak wyraźnego zwycięzcy"
  return `${decisive ? "Zdecydowane" : "Minimalne"} zwycięstwo ${OF_SIDE[winner]}`
}

function summary(): string {
  const {lost, bombed, ships} = tally()
  return [
    `straty: Amerykanie ${lost[R_Amer]}, Japończycy ${lost[R_Jap]}`,
    ...(G.targets?.length ? [`zbombardowane cele: ${bombed}/${G.targets.length}`] : []),
    ...ships.map(ship => `${ship.nazwa}: ${ship.sunk ? "zatopiony" : `uszkodzenia ${ship.damage ?? 0}/${shipType(ship).wytrzymalosc}`}`),
  ].join(", ")
}

// 8.0.2: planes yet to come count as well, or a side could lose before they enter.
function hasUnitsLeft(side: number): boolean {
  return G.board.planes[side].some(plane => !plane.destroyed)
    || (G.to_place?.[side] ?? []).length > 0
    || (G.off_board ?? []).some(it => parseInt(it.plane.id) === side)
    || (G.reinforcements?.[side] ?? []).length > 0
    || (G.aa_guns ?? []).some(it => it.side === side)
    || (G.ships ?? []).some(it => it.side === side && !it.sunk)
}

// 8.0.2: the game ends once only one player has units left.
export function isGameOver(): boolean {
  return !hasUnitsLeft(R_Amer) || !hasUnitsLeft(R_Jap)
}

function endGame() {
  const outcome = currentOutcome()
  delete G.selected_plane
  delete G.selected_altitude
  delete G.selected_gun
  finish(outcome.winner ?? "Draw", `${describeOutcome(outcome)}: ${summary()}`)
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
