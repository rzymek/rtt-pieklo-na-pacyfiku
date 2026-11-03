import type {Ship} from "./ships";
import {shipType} from "./ships";

// 8.0.1: decisive or minimal victory, or no clear winner (winner: null).
export interface Outcome {
  winner: number | null
  decisive: boolean
}

// What the victory conditions count, at the end of the game.
export interface Tally {
  // Planes shot down, or lost otherwise: not those that left the board for good (8.0.2).
  lost: Record<number, number>
  // Strategic objects bombed.
  bombed: number
  ships: Ship[]
}

export type VictoryRule = (tally: Tally) => Outcome

export const NO_WINNER: Outcome = {winner: null, decisive: false}
const decisive = (side: number): Outcome => ({winner: side, decisive: true})
const minimal = (side: number): Outcome => ({winner: side, decisive: false})

// A score compared with the table of the scenario: the outcome of the first band the score reaches.
// Five bands, from the decisive victory of `side` down to the decisive victory of `other`.
export function byScore(score: (tally: Tally) => number, side: number, other: number,
                        [decisiveFrom, minimalFrom, noWinnerFrom, otherMinimalFrom]: [number, number, number, number]): VictoryRule {
  return tally => {
    const value = score(tally)
    if (value >= decisiveFrom) return decisive(side)
    if (value >= minimalFrom) return minimal(side)
    if (value >= noWinnerFrom) return NO_WINNER
    if (value >= otherMinimalFrom) return minimal(other)
    return decisive(other)
  }
}

export interface ShipConditions {
  attacker: number
  defender: number
  ship: string
  // The damage from which the ship counts as heavily damaged.
  heavy: number
  // Sunk: the attacker's decisive victory up to this many planes lost, a minimal one up to the next, no winner above.
  sunk: [number, number]
  // Heavily damaged: no winner up to this many planes lost, the defender's minimal victory up to the next, decisive above.
  damaged: [number, number]
}

// Scenarios 3, 4, 5, 7: the main ship sunk or heavily damaged, against the planes the attacker lost.
// A ship that is not heavily damaged is the defender's decisive victory.
export function byShip({attacker, defender, ship, heavy, sunk, damaged}: ShipConditions): VictoryRule {
  return tally => {
    const target = tally.ships.find(it => it.id === ship)!
    const lost = tally.lost[attacker]
    const damage = target.damage ?? 0
    if (target.sunk || damage >= shipType(target).wytrzymalosc) {
      return lost <= sunk[0] ? decisive(attacker) : lost <= sunk[1] ? minimal(attacker) : NO_WINNER
    }
    if (damage >= heavy) {
      return lost <= damaged[0] ? NO_WINNER : lost <= damaged[1] ? minimal(defender) : decisive(defender)
    }
    return decisive(defender)
  }
}
