import {describe, expect, it, vi} from "vitest";
import {CLOUD_HEXES} from "./terrain";
import {planes, R_Amer, R_Jap} from "../globals";
import type {PlaneInstance} from "../types";
import type {PlaneData} from "./data";
import {applyHit, COMBAT_TABLE, damageFor, describeShot, fireLineHexes, fireLines, hitChance, rollShot, targetsOnFireLines} from "./combat";

vi.mock("../game/victory", () => ({scorePlaneLost: vi.fn()}));

const N = 0, S = 3

function shoot(sila_ataku: number, distance: number, d1: number, d2: number) {
  const dice = [d1 - 1, d2 - 1];
  vi.stubGlobal("random", () => dice.shift());
  const attacker = {id: "1.0", plane: {...planes.A6M6, sila_ataku} as PlaneData, at: "A20.B20", direction: 0};
  const target = {id: "0.0", plane: planes.SBD, at: "A20.B21", direction: 0};
  return rollShot(attacker, target, distance);
}

function zero(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "1.0", plane: planes.A6M, at: "A20.B20", direction: N, ...overrides}
}

function dauntless(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane: planes.SBD, at: "A20.B20", direction: N, ...overrides}
}

describe('table 1', () => {
  it('5.2: attack strength 4, distance 2: 7-8 one damage, 9-10 two, 11 three', () => {
    expect([6, 7, 8, 9, 10, 11].map(roll => damageFor(4, 2, roll))).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('fig. 6: attack strength 3, distance 2, a roll of 10 gives 2 damage', () => {
    expect(damageFor(3, 2, 10)).toBe(2);
  });

  it('attack strength 5, distance 1: 5-6, 7-8 and 9-11', () => {
    expect([4, 5, 6, 7, 8, 9, 10, 11].map(roll => damageFor(5, 1, roll))).toEqual([0, 1, 1, 2, 2, 3, 3, 3]);
  });

  it('attack strength 0 never damages', () => {
    for (let roll = 2; roll <= 12; roll++) expect(damageFor(0, 1, roll)).toBe(0);
  });

  it.each([1, 2, 3, 4, 5])('attack strength %i: more damage with a higher roll, no more with a longer distance', atk => {
    for (let distance = 1; distance <= 5; distance++) {
      const damage = [3, 4, 5, 6, 7, 8, 9, 10, 11].map(roll => damageFor(atk, distance, roll));
      expect(damage).toEqual([...damage].sort((a, b) => a - b));
      for (let roll = 3; roll <= 11; roll++) expect(damageFor(atk, distance, roll)).toBeLessThanOrEqual(damageFor(atk, Math.max(1, distance - 1), roll));
      expect(COMBAT_TABLE[atk][distance - 1].every(range => !range || range[1] <= 11)).toBe(true);
    }
  });

  it.each([[1, 1], [6, 6]])('a roll of %i+%i jams the guns, with no damage (5.3.4)', (d1, d2) => {
    const shot = shoot(5, 1, d1, d2);
    expect(shot.damage).toBe(0);
    expect(shot.result).toBe('zacięcie karabinów');
  });

  it('5.3.3: a 1 on a die of a damaging roll shoots the target down', () => {
    expect(shoot(4, 1, 1, 6)).toMatchObject({damage: 1, downed: true});
    expect(shoot(4, 1, 2, 5)).toMatchObject({damage: 1, downed: false});
    expect(shoot(1, 1, 1, 6)).toMatchObject({damage: 0, downed: false});
  });

  it('the chance counts the damaging rolls, without the jams', () => {
    // 6-11 at attack strength 4, distance 1: 5 + 6 + 5 + 4 + 3 + 2 of the 36 outcomes.
    expect(hitChance(4, 1)).toBeCloseTo(25 / 36);
  });
});

describe('damage (2.2)', () => {
  it('turns the counter over at half the endurance', () => {
    const plane = dauntless();
    expect(applyHit(plane, 2)).toBe("uszkodzony, pozostała wytrzymałość 4/6");
    expect(plane.damaged).toBeUndefined();
    expect(applyHit(plane, 1)).toBe("poważnie uszkodzony, pozostała wytrzymałość 3/6");
    expect(plane.damaged).toBe(true);
    expect(plane.destroyed).toBeUndefined();
  });

  it('shoots the plane down once the endurance is used up', () => {
    const plane = dauntless({damage: 4, damaged: true});
    expect(applyHit(plane, 3)).toBe("zestrzelony");
    expect(plane).toMatchObject({destroyed: true, damage: 6});
  });

  it('shoots it down at once after a 1 on a die (5.3.3)', () => {
    const plane = dauntless();
    expect(applyHit(plane, 1, true)).toBe("zestrzelony");
    expect(plane.destroyed).toBe(true);
  });
});

describe('fire lines (5.1, fig. 3 and 4)', () => {
  it('a fighter fires 5 hexes ahead only', () => {
    expect(fireLines(zero())).toEqual([{rear: false, hexes: ["A20.B21", "A20.B22", "A20.B23", "A20.B24", "A20.B25"]}]);
  });

  it('a plane with a rear strength fires also straight back and along both rear diagonals', () => {
    const lines = fireLines(dauntless());
    expect(lines.map(it => it.rear)).toEqual([false, true, true, true]);
    expect(lines[2].hexes).toEqual(["A20.B19", "A20.B18", "A20.B17", "A20.B16", "A20.B15"]);
    expect(lines[1].hexes[0]).toBe("A21.B20");
    expect(lines[3].hexes[0]).toBe("A19.B19");
  });

  it('no line for an attack strength of 0: the Kate fires to the rear only', () => {
    expect(fireLines({...dauntless(), plane: planes.B5N}).map(it => it.rear)).toEqual([true, true, true]);
  });

  it('a damaged plane uses the strengths from the reverse', () => {
    // Damaged Dauntless: 1/0
    expect(fireLines(dauntless({damaged: true})).map(it => it.rear)).toEqual([false]);
  });

  it('1 hex on every line from a cloud (5.1.1)', () => {
    expect(fireLineHexes(dauntless({at: CLOUD_HEXES[0]}))).toHaveLength(4);
  });

  it('finds the first plane on each line', () => {
    const rearTarget = zero({at: "A20.B17", direction: S});
    const ahead = zero({id: "1.1", at: "A20.B22"});
    const behindAhead = zero({id: "1.2", at: "A20.B23"});
    const targets = targetsOnFireLines(dauntless(), {[R_Amer]: [dauntless()], [R_Jap]: [rearTarget, ahead, behindAhead]});
    expect(targets.map(it => [it.plane.id, it.distance, it.rear])).toEqual([["1.1", 2, false], ["1.0", 3, true]]);
  });
});

describe("describeShot", () => {
  const plane = (overrides: Partial<PlaneInstance> = {}): PlaneInstance =>
    ({id: "1.0", plane: {...planes.A6M6, sila_ataku: 4} as PlaneData, at: "A20.B20", direction: 0, ...overrides});
  const target = (distance: number, overrides: Partial<PlaneInstance> = {}) =>
    ({side: R_Amer, idx: 0, plane: dauntless(overrides), distance, rear: false});

  it('shows the target, the strength, the distance, the rolls for each damage and the chances', () => {
    expect(describeShot(plane(), target(2)))
      .toBe("SBD Dauntless, SA 4, odległość 2: rzut 7–8: 1, 9–10: 2, 11: 3 uszk. – trafienie 56%, zacięcie 6%");
  });

  it('shows the strength of a damaged plane', () => {
    const damaged = plane({damaged: true});
    expect(describeShot(damaged, target(1)))
      .toContain(`SA ${damaged.plane.reduced.sila_ataku} (uszkodzony)`);
  });

  it('shows a rear shot', () => {
    expect(describeShot(dauntless(), {...target(1), rear: true})).toContain("SA do tyłu 1");
  });

  it('shows the modifiers of clouds', () => {
    const description = describeShot(plane({at: CLOUD_HEXES[0]}), target(1, {at: CLOUD_HEXES[0]}));
    expect(description).toContain("SA 4, chmura atakującego −2, chmura celu −2 = SA 0");
    expect(description).toContain("bez szans – trafienie 0%");
  });
});
