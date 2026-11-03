import type {PlaneInstance} from "../types";

// 7.0: one series of bombs, or a torpedo, per point of the plane's load.
export function bombsLeft(plane: PlaneInstance): number {
  return (plane.plane.udzwig_bomb ?? 0) - (plane.bombs_dropped ?? 0)
}

export type AttackKind = "poziome" | "nurkowe" | "torpeda"

type Range = [number, number] | null
const R = (from: number, to = from): Range => [from, to]

// Tables 6, 7, 8: [damage, not under fire, under fire]
const TABLES: Record<AttackKind, [number, Range, Range][]> = {
  poziome: [[4, R(12), null], [3, R(11), R(12)], [2, R(10), R(11)], [1, R(9), R(10)]],
  nurkowe: [[4, R(10, 12), null], [3, R(8, 9), R(11, 12)], [2, R(7), R(9, 10)], [1, R(6), R(7, 8)]],
  torpeda: [[7, R(12), null], [6, R(10, 11), R(12)], [5, R(8, 9), R(10, 11)], [3, R(7), R(9)]],
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
