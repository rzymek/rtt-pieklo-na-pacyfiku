import {G, L, R, R_Amer, R_Jap, V} from "../globals";
import {gunsOf} from "../procedures/aa_guns";
import {shipType} from "../game/ships";
import {movesMapFor} from "../game/hex";
import {fireLineHexes} from "../game/combat";
import {selectedPlaneOfTheActiveSide} from "../procedures/selectedPlaneOfTheActiveSide";
import {fireTarget} from "../procedures/shooters";
import {returnHexes} from "../procedures/return_planes";
import {sunHexes} from "../game/sun";

export function on_view() {
  V.board = G.board
  V.active_side = G.active as number
  V.stage = G.stage
  V.off_board = (G.off_board ?? []).map(it => ({
    name: it.plane.plane.nazwa,
    side: parseInt(it.plane.id),
    return_stage: it.return_stage,
    hexes: returnHexes(it),
  }))
  V.shot = G.shot
  V.bombed = G.bombed
  V.targets = G.targets
  V.aa_guns = [...gunsOf(R_Amer), ...gunsOf(R_Jap)]
  V.ships = (G.ships ?? []).map(ship => ({...ship, wytrzymalosc: shipType(ship).wytrzymalosc}))
  V.aa_fired = G.aa_fired
  V.selected_gun = G.selected_gun
  V.vp = G.vp
  V.min_vp = G.min_vp
  V.sun = G.sun
  V.sun_hexes = G.sun && sunHexes(G.sun)
  if (R === G.active) {
    if (L.P === 'move_planes') {
      const moved = G.moved ?? []
      V.unmoved = G.board.planes[G.active as number]
        .filter(plane => !plane.destroyed && !set_has(moved, plane.id))
        .map(plane => plane.id)
    }
    if (G.selected_plane !== undefined) {
      const plane = selectedPlaneOfTheActiveSide();
      if (plane) {
        V.selected_plane = plane.id
        if (L.P === 'move_planes') {
          // A plane selected after its move is only there to drop bombs.
          if (!set_has(G.moved ?? [], plane.id))
            V.moves = movesMapFor(plane, G.board.planes, G.selected_altitude)
        } else {
          V.fire_line = fireLineHexes(plane)
          // Nothing to shoot at while setting up.
          if (L.P !== 'place_planes' && L.P !== 'return_planes')
            V.fire_target = fireTarget(plane, G.active as number)?.plane.id
        }
      }
    }
  }
}
