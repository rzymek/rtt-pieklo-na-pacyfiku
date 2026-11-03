import {describe, expect, it, vi} from "vitest";
import {planes} from "../globals";
import type {PlaneInstance} from "../types";
import {AaGun, aaPenalty, aaShot, canFireAt, canPlaceGun, describeAaShot} from "./aa";
import {CLOUD_HEXES, LAND_HEXES} from "./terrain";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

const GUN = "A20.B20"
const heavy: AaGun = {id: GUN, side: 1, heavy: true, hexes: [GUN]}
const light: AaGun = {...heavy, heavy: false}

function plane(at: string, altitude: number): PlaneInstance {
  return {id: "0.0", plane: planes.SBD, at, direction: 0, altitude}
}

// Straight north of the gun.
const at = (distance: number) => `A20.B${20 + distance}`

describe('range (6.0.1, 6.0.2)', () => {
  it('a heavy gun reaches 8 hexes, at every altitude', () => {
    expect(canFireAt(heavy, plane(at(8), 5))).toBe(true);
    expect(canFireAt(heavy, plane(at(9), 1))).toBe(false);
  });

  it('a light one reaches 5 hexes, below the top altitude', () => {
    expect(canFireAt(light, plane(at(5), 4))).toBe(true);
    expect(canFireAt(light, plane(at(6), 4))).toBe(false);
    expect(canFireAt(light, plane(at(0), 5))).toBe(false);
  });

  it('a ship fires from the nearest of its hexes (6.1.4)', () => {
    const ship: AaGun = {...light, hexes: ["A20.B10", "A20.B11", "A20.B12"]}
    expect(canFireAt(ship, plane("A20.B17", 2))).toBe(true);
    expect(canFireAt(ship, plane("A20.B18", 2))).toBe(false);
  });
});

describe('tables 9 and 10 (6.2)', () => {
  it.each([
    // gun, altitude, distance, roll, under fire, damage
    [heavy, 2, 0, 7, false, 0],
    [heavy, 2, 4, 8, true, 0],
    [heavy, 2, 4, 9, true, 0],
    [heavy, 2, 4, 10, true, 3],
    [heavy, 2, 8, 12, false, 0],
    [heavy, 4, 6, 11, true, 3],
    [heavy, 4, 6, 12, false, 0],
    [heavy, 5, 7, 10, false, 0],
    [heavy, 5, 7, 12, true, 3],
    [light, 1, 3, 7, true, 0],
    [light, 1, 3, 9, true, 2],
    [light, 4, 5, 9, true, 0],
    [light, 4, 5, 10, true, 2],
  ] as const)('%#: altitude %i, distance %i, roll %i', (gun, altitude, distance, roll, underFire, damage) => {
    expect(aaShot(gun, plane(at(distance), altitude), roll)).toEqual({underFire, damage});
  });

  it('subtracts 2 from the roll in the clouds (6.3.5)', () => {
    const cloud: AaGun = {...heavy, hexes: [CLOUD_HEXES[0]]};
    const inCloud = plane(CLOUD_HEXES[0], 3);
    expect(aaPenalty(cloud, inCloud)).toBe(2);
    expect(aaShot(cloud, inCloud, 12)).toEqual({underFire: true, damage: 3});
    expect(aaShot(cloud, inCloud, 11)).toEqual({underFire: true, damage: 0});
    expect(aaPenalty(cloud, plane(CLOUD_HEXES[0], 2))).toBe(0);
  });

  it('describes the odds', () => {
    expect(describeAaShot(heavy, plane(at(5), 4))).toBe("SBD Dauntless, odl. 5: pod ostrzałem 8–9, trafienie 10–11");
  });
});

it('one gun per hex, on land only (6.1.2)', () => {
  const land = LAND_HEXES[0];
  expect(canPlaceGun(land, [])).toBe(true);
  expect(canPlaceGun(land, [{hex: land, side: 1, heavy: true}])).toBe(false);
  expect(canPlaceGun(GUN, [])).toBe(false);
});
