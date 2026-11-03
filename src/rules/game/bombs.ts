import type {PlaneInstance} from "../types";

// 7.0: one series of bombs, or a torpedo, per point of the plane's load.
export function bombsLeft(plane: PlaneInstance): number {
  return (plane.plane.udzwig_bomb ?? 0) - (plane.bombs_dropped ?? 0)
}

export type AttackKind = "poziome" | "nurkowe" | "torpeda"

type Range = [number, number] | null
const rolls = (from: number, to = from): Range => [from, to]

// Tables 6, 7, 8: [damage, not under fire, under fire]
const TABLES: Record<AttackKind, [number, Range, Range][]> = {
  poziome: [[4, rolls(12), null], [3, rolls(11), rolls(12)], [2, rolls(10), rolls(11)], [1, rolls(9), rolls(10)]],
  nurkowe: [[4, rolls(10, 12), null], [3, rolls(8, 9), rolls(11, 12)], [2, rolls(7), rolls(9, 10)], [1, rolls(6), rolls(7, 8)]],
  torpeda: [[7, rolls(12), null], [6, rolls(10, 11), rolls(12)], [5, rolls(8, 9), rolls(10, 11)], [3, rolls(7), rolls(9)]],
}

// 7.2, 7.3.2: the plane under AA fire this stage (6.2) uses the other column.
export function attackDamage(kind: AttackKind, underFire: boolean, roll: number): number {
  const row = TABLES[kind].find(([, clear, fired]) => {
    const range = underFire ? fired : clear
    return !!range && roll >= range[0] && roll <= range[1]
  })
  return row?.[0] ?? 0
}

export const ATTACK_NAMES: Record<AttackKind, string> = {
  poziome: "bombardowanie z lotu poziomego",
  nurkowe: "bombardowanie z lotu nurkowego",
  torpeda: "atak torpedowy",
}
