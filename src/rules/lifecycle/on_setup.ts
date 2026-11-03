import {G, R_Amer, R_Jap} from "../globals.js"
import type {PlaneToPlace} from "../types";
import {Deployment, SCENARIOS} from "../game/scenarios";
import {SUN_EDGE_NAMES, sunEdgeFor} from "../game/sun";
import {SHIP_TYPES, shipHexes} from "../game/ships";

export const scenarios = Object.keys(SCENARIOS)

// 9.3
function toPlace(side: number, deployments: Deployment[]): PlaneToPlace[] {
  return deployments
    .flatMap(({center, radius, direction, planes}) => planes.map(plane => ({center, radius, direction, plane})))
    .map((it, idx) => ({...it, id: `${side}.${idx}`}))
}

export function on_setup(scenario: string, _options: unknown) {
  const {japonczycy, amerykanie, targets} = SCENARIOS[scenario]
  G.scenario = scenario
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
  G.flights = {}
  G.bombed = []
  // 5.0.1
  G.sun = sunEdgeFor(random(6) + 1)
  log(`Słońce: ${SUN_EDGE_NAMES[G.sun]}`)
  G.aa_guns = []
  G.ships = [R_Amer, R_Jap].flatMap(side => ((side === R_Jap ? japonczycy : amerykanie).ships ?? [])
    .map(({type, nazwa, from, towards}, i) => ({
      id: `${side}.s${i}`, side, type, nazwa: nazwa ?? SHIP_TYPES[type].nazwa,
      hexes: shipHexes(from, towards, SHIP_TYPES[type].dlugosc),
    })))
  G.aa_fired = []
  G.active = R_Jap
  const gunSide = [R_Jap, R_Amer].find(side => (side === R_Jap ? japonczycy : amerykanie).aa_guns)
  if (gunSide !== undefined) {
    G.active = gunSide
    call("place_aa_guns", (gunSide === R_Jap ? japonczycy : amerykanie).aa_guns)
  } else {
    call("place_planes")
  }
}
