import {beforeEach, describe, expect, it, vi} from "vitest";
import {G, planes} from "../globals";
import type {PlaneInstance} from "../types";
import {ALT_LOW} from "./altitude";
import {aaHitFrom} from "./aa";
import {rollShot} from "./combat";
import {sunEdgeFor, sunHexes, sunPenalty} from "./sun";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

const N = 0, NE = 1, SE = 2, S = 3, SW = 4, NW = 5

function spit(at: string, direction: number): PlaneInstance {
  return {id: "1.0", plane: planes.A6M6, at, direction}
}

const clearTarget = spit("A20.B20", N)

beforeEach(() => {
  delete G.sun;
  vi.stubGlobal("random", () => 2);
});

describe('placing the sun (5.0.1)', () => {
  it.each([[1, "E"], [2, "E"], [3, "S"], [4, "S"], [5, "W"], [6, "W"]])('roll %i: %s', (roll, edge) => {
    expect(sunEdgeFor(roll)).toBe(edge);
  });

  it.each(["E", "S", "W"] as const)('the shield is 10 hexes long: %s', edge => {
    expect(sunHexes(edge)).toHaveLength(10);
  });
});

describe('firing into the sun (5.0.1)', () => {
  it.each([
    ["W", "A05.B20", NW, 1],
    ["W", "A05.B20", SW, 1],
    ["W", "A05.B10", SW, 0],
    ["W", "A05.B20", N, 0],
    ["W", "A05.B20", NE, 0],
    ["E", "A50.B44", NE, 1],
    ["E", "A50.B44", SE, 1],
    ["E", "A50.B44", N, 0],
    ["S", "A28.B25", S, 1],
    ["S", "A28.B25", N, 0],
    ["S", "A28.B25", SE, 0],
    ["S", "A28.B25", SW, 0],
    ["S", "A10.B20", S, 0],
  ] as const)('%s edge, from %s, direction %i: -%i', (edge, at, direction, penalty) => {
    G.sun = edge;
    expect(sunPenalty(spit(at, direction), clearTarget)).toBe(penalty);
  });

  it('lowers the attack strength', () => {
    G.sun = "S";
    expect(rollShot(spit("A28.B25", S), clearTarget, 1).atk).toBe(3);
    expect(rollShot(spit("A28.B25", N), clearTarget, 1).atk).toBe(4);
  });

  it('does not count when firing into a cloud (5.0.3)', () => {
    G.sun = "S";
    const attacker = spit("A30.B20", S);
    expect(sunPenalty(attacker, spit("A33.B28", N))).toBe(0);
    expect(sunPenalty(attacker, spit("A33.B24", N))).toBe(0);
  });

  it('does nothing without a sun, as in an older saved game', () => {
    expect(sunPenalty(spit("A20.B20", S), clearTarget)).toBe(0);
  });
});

describe('AA guns (6.2.5)', () => {
  const low = (at: string): PlaneInstance => ({...spit(at, N), altitude: ALT_LOW});

  it('cannot hit a plane against the sun', () => {
    G.sun = "W";
    expect(aaHitFrom("A05.B20", low("A04.B20"))).toBeNull();
  });

  it('can hit it from the other side', () => {
    G.sun = "W";
    expect(aaHitFrom("A03.B20", low("A04.B20"))).toBe(6);
  });

  it('can hit a plane right above the gun', () => {
    G.sun = "W";
    expect(aaHitFrom("A04.B20", low("A04.B20"))).toBe(5);
  });
});
