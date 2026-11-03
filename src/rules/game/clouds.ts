import {CLOUD_EDGE_HEXES, CLOUD_HEXES} from "./terrain";
import type {PlaneInstance} from "../types";
import {ALT_LOW, altitudeOf} from "./altitude";

// 5.0.4: the clouds are at altitudes 3, 4 and 5; planes below are not affected.
function isAtCloudAltitude(plane: PlaneInstance): boolean {
  return altitudeOf(plane) >= ALT_LOW
}

export function isInCloud(plane: PlaneInstance): boolean {
  return isAtCloudAltitude(plane) && CLOUD_HEXES.includes(plane.at)
}

function isAtCloudEdge(plane: PlaneInstance): boolean {
  return isAtCloudAltitude(plane) && CLOUD_EDGE_HEXES.includes(plane.at)
}

// 5.0.2: the same value is subtracted for the attacker and for the target.
export function cloudPenalty(plane: PlaneInstance): number {
  return isInCloud(plane) ? 2 : isAtCloudEdge(plane) ? 1 : 0
}
