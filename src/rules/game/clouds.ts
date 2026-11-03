import {CLOUD_EDGE_HEXES, CLOUD_HEXES} from "./terrain";
import type {PlaneInstance} from "../types";
import {ALT_HIGH, altitudeOf} from "./altitude";

// 5.0.4: clouds are at the high altitude only, planes below are not affected.
export function isInCloud(plane: PlaneInstance): boolean {
  return altitudeOf(plane) === ALT_HIGH && CLOUD_HEXES.includes(plane.at)
}

function isAtCloudEdge(plane: PlaneInstance): boolean {
  return altitudeOf(plane) === ALT_HIGH && CLOUD_EDGE_HEXES.includes(plane.at)
}

// 5.0.2: the same value is subtracted for the attacker and for the target.
export function cloudPenalty(plane: PlaneInstance): number {
  return isInCloud(plane) ? 2 : isAtCloudEdge(plane) ? 1 : 0
}
