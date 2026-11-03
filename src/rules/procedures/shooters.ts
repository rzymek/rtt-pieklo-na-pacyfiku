import type {PlaneInstance} from "../types";
import {G} from "../globals";
import {FireTarget, targetsOnFireLines} from "../game/combat";

// The enemy planes `plane` may fire at right now (5.3.1, 5.3.2, 5.3.4).
export function fireTargets(plane: PlaneInstance, side: number): FireTarget[] {
  if (plane.destroyed || plane.jammed || (plane.unjammed_stage !== undefined && plane.unjammed_stage === G.stage) || set_has(G.shot ?? [], plane.id)) return []
  return targetsOnFireLines(plane, G.board.planes).filter(hit => hit.side !== side)
}

// The target chosen by the player (G.selected_target), or the nearest one.
export function fireTarget(plane: PlaneInstance, side: number): FireTarget | null {
  const targets = fireTargets(plane, side).sort((a, b) => a.distance - b.distance)
  return targets.find(it => it.plane.id === G.selected_target) ?? targets[0] ?? null
}

// 5.3.4: one attempt per stage, which takes the place of the plane's shot.
export function canUnjam(plane: PlaneInstance): boolean {
  return !!plane.jammed && !plane.destroyed && !set_has(G.shot ?? [], plane.id)
}

export function markShot(plane: PlaneInstance) {
  G.shot ??= []
  set_add(G.shot, plane.id)
}

export function shootersOf(side: number): PlaneInstance[] {
  return G.board.planes[side].filter(plane => fireTargets(plane, side).length > 0)
}

// 5.3.1: the player picks one of the planes on the fire lines.
export function selectTarget(plane: PlaneInstance | undefined, side: number, targetId: string) {
  if (plane && fireTargets(plane, side).some(it => it.plane.id === targetId)) G.selected_target = targetId
}
