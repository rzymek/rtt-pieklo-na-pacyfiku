import {G, R_Amer, R_Jap} from "../globals.js"
import type {PlaneToPlace} from "../types";
import {Deployment, SCENARIOS} from "../game/scenarios";
import {SUN_EDGE_NAMES, sunEdgeFor} from "../game/sun";

export const scenarios = Object.keys(SCENARIOS)

// 9.3
function toPlace(side: number, deployments: Deployment[]): PlaneToPlace[] {
  return deployments
    .flatMap(({center, radius, direction, planes}) => planes.map(plane => ({center, radius, direction, plane})))
    .map((it, idx) => ({...it, id: `${side}.${idx}`}))
}

export function on_setup(scenario: string, _options: unknown) {
  const {japonczycy, amerykanie, targets, all_targets_vp} = SCENARIOS[scenario]
  G.board = {planes: {[R_Amer]: [], [R_Jap]: []}}
  G.to_place = {
    [R_Jap]: toPlace(R_Jap, japonczycy.deployments),
    [R_Amer]: toPlace(R_Amer, amerykanie.deployments),
  }
  G.off_board = []
  G.reinforcements = {
    [R_Jap]: japonczycy.reinforcements ?? [],
    [R_Amer]: amerykanie.reinforcements ?? [],
  }
  G.stage = 1
  G.targets = targets
  G.moved = []
  G.shot = []
  G.flown_over = {}
  G.bombed = []
  // 8.0
  G.vp = {[R_Amer]: 0, [R_Jap]: 0}
  G.min_vp = {[R_Amer]: amerykanie.min_vp, [R_Jap]: japonczycy.min_vp}
  G.all_targets_vp = all_targets_vp
  // 5.0.1
  G.sun = sunEdgeFor(random(6) + 1)
  log(`Słońce: ${SUN_EDGE_NAMES[G.sun]}`)
  G.aa_guns = []
  G.aa_fired = []
  G.active = R_Jap
  if (japonczycy.aa_guns) {
    call("place_aa_guns", {count: japonczycy.aa_guns})
  } else {
    call("place_planes")
  }
}
