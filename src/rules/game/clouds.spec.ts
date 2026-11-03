import {beforeEach, describe, expect, it, vi} from "vitest";
import {planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {ALT_LOW} from "./altitude";
import {fireLineHexes, firstOnFireLine, rollShot} from "./combat";

const CLOUD = "A33.B28"
const EDGE = "A33.B24"
const CLEAR = "A20.B20"

let dice: number[];

function spit(at: string, overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "1.0", plane: planes.Spit, at, direction: 0, ...overrides}
}

function he111(at: string, overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane: planes.HE111, at, direction: 3, ...overrides}
}

// Each die is rolled as random(6) + 1
const roll = (...values: number[]) => dice = values.map(it => it - 1);

beforeEach(() => {
  vi.stubGlobal("random", () => dice.shift());
  roll(3, 3);
});

describe('attack strength (5.0.2)', () => {
  it('is not modified in the clear', () => {
    expect(rollShot(spit(CLEAR), he111(CLEAR), 1).atk).toBe(4);
  });

  it('drops by 2 for a target in a cloud', () => {
    expect(rollShot(spit(CLEAR), he111(CLOUD), 1).atk).toBe(2);
  });

  it('drops by 1 for a target at the edge of a cloud', () => {
    expect(rollShot(spit(CLEAR), he111(EDGE), 1).atk).toBe(3);
  });

  it('drops by 2 for an attacker in a cloud', () => {
    expect(rollShot(spit(CLOUD), he111(CLEAR), 1).atk).toBe(2);
  });

  it('drops by 1 for an attacker at the edge of a cloud', () => {
    expect(rollShot(spit(EDGE), he111(CLEAR), 1).atk).toBe(3);
  });

  it('adds up for both planes', () => {
    expect(rollShot(spit(EDGE), he111(CLOUD), 1).atk).toBe(1);
  });

  it('does not go below 0 (5.0.7)', () => {
    expect(rollShot(spit(CLOUD, {plane: planes.HE111}), he111(CLOUD), 1).atk).toBe(0);
  });

  it('changes the outcome of the roll', () => {
    roll(3, 4); // Spit atk 4, distance 1: 7-11, atk 2: 9-11
    expect(rollShot(spit(CLEAR), he111(CLEAR), 1).hit).toBe(true);
    roll(3, 4);
    expect(rollShot(spit(CLEAR), he111(CLOUD), 1).hit).toBe(false);
  });

  it('an attack strength of 0 never hits, but the guns can still jam', () => {
    roll(5, 5);
    expect(rollShot(spit(CLOUD), he111(CLOUD), 1).hit).toBe(false);
    roll(6, 6);
    const attacker = spit(CLOUD);
    rollShot(attacker, he111(CLOUD), 1);
    expect(attacker.jammed).toBe(true);
  });

  it('is not affected below the clouds (5.0.4)', () => {
    const atk = rollShot(spit(CLOUD, {altitude: ALT_LOW}), he111(EDGE, {altitude: ALT_LOW}), 1).atk;
    expect(atk).toBe(4);
  });
});

describe('fire line (5.0.5)', () => {
  it('has 5 hexes in the clear', () => {
    expect(fireLineHexes(spit(CLEAR))).toHaveLength(5);
  });

  it('has 5 hexes at the edge of a cloud', () => {
    expect(fireLineHexes(spit(EDGE))).toHaveLength(5);
  });

  it('has 1 hex in a cloud', () => {
    expect(fireLineHexes(spit(CLOUD))).toEqual(["A33.B29"]);
  });

  it('has 5 hexes below a cloud (5.0.4)', () => {
    expect(fireLineHexes(spit(CLOUD, {altitude: ALT_LOW}))).toHaveLength(5);
  });

  it('keeps a plane in a cloud from reaching further targets', () => {
    const shooter = spit(CLOUD);
    const allPlanes = {[R_Amer]: [he111("A33.B30")], [R_Jap]: [shooter]};
    expect(firstOnFireLine(shooter, allPlanes)).toBeNull();
    allPlanes[R_Amer][0].at = "A33.B29";
    expect(firstOnFireLine(shooter, allPlanes)?.distance).toBe(1);
  });
});
