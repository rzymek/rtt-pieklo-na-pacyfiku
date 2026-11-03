import {G} from "../globals";

export function select_plane(planeId: string) {
  delete G.selected_altitude
  delete G.leaving
  delete G.selected_target
  if (G.selected_plane === planeId) {
    delete G.selected_plane
  } else {
    G.selected_plane = planeId
  }
}