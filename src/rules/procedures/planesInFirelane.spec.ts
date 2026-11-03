import {G, planes} from "../globals";
import {describe, expect, it, vi} from "vitest";
import {planesInFirelane} from "./planesInFirelane";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

describe('planesInFirelane', () => {
  it('example', () => {
    G.board = {
      "planes": {
        "0": [{
          "plane": planes.SBD, "at": "A35.B30", "direction": 4, "id": "0.0"
        }, {
          "plane": planes.SBD, "at": "A36.B31", "direction": 3, "id": "0.1"
        }, {
          "plane": planes.SBD, "at": "A37.B31", "direction": 4, "id": "0.2"
        }, {
          "plane": planes.SBD, "at": "A38.B31", "direction": 4, "id": "0.3"
        }, {
          "plane": planes.SBD, "at": "A35.B31", "direction": 4, "id": "0.4"
        }, {
          "plane": planes.SBD, "at": "A34.B31", "direction": 4, "id": "0.5"
        }],
        "1": [{
          "plane": planes.A6M6, "at": "A10.B08", "direction": 0, "id": "1.0"
        }, {
          "plane": planes.A6M6, "at": "A11.B08", "direction": 1, "id": "1.1"
        }, {
          "plane": planes.A6M6, "at": "A09.B08", "direction": 2, "id": "1.2"
        }]
      }
    }

    expect(planesInFirelane(1)).toEqual([])
  })
});
