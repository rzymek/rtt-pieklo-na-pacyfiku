import {describe, expect, it, vi} from "vitest";
import {G, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {ALT_HIGH, ALT_LOW, ALT_LOWEST, ALT_VERY_HIGH, ALT_VERY_LOW, canChangeAltitude, maxSpeedAt} from "./altitude";
import {firstOnFireLine} from "./combat";
import {exitsFor, movesMapFor} from "./hex";
import {planesInFirelane} from "../procedures/planesInFirelane";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

function spit(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "1.0", plane: planes.A6M6, at: "A20.B20", direction: 0, ...overrides}
}

function he111(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane: planes.SBD, at: "A20.B22", direction: 3, ...overrides}
}

describe('canChangeAltitude', () => {
  it('allows one or two levels down (4.2.2)', () => {
    expect(canChangeAltitude(spit(), ALT_HIGH)).toBe(true);
    expect(canChangeAltitude(spit(), ALT_LOW)).toBe(true);
    expect(canChangeAltitude(spit(), ALT_VERY_LOW)).toBe(false);
  });

  it('allows only one level up (4.2.3)', () => {
    expect(canChangeAltitude(spit({altitude: ALT_LOWEST}), ALT_VERY_LOW)).toBe(true);
    expect(canChangeAltitude(spit({altitude: ALT_LOWEST}), ALT_LOW)).toBe(false);
  });

  it('forbids a climb that would drop the limit below the minimum speed (4.2.3)', () => {
    expect(canChangeAltitude(he111({altitude: ALT_LOW}), ALT_HIGH)).toBe(true);
    // damaged Dauntless: max 3, min 3
    expect(canChangeAltitude(he111({altitude: ALT_LOW, damaged: true}), ALT_HIGH)).toBe(false);
    expect(canChangeAltitude(he111({altitude: ALT_LOW, damaged: true}), ALT_VERY_LOW)).toBe(true);
    expect(canChangeAltitude(he111({altitude: ALT_LOW, damaged: true}), ALT_LOW)).toBe(true);
  });

  it('rejects levels that do not exist', () => {
    expect(canChangeAltitude(spit(), 6)).toBe(false);
    expect(canChangeAltitude(spit({altitude: ALT_LOWEST}), 0)).toBe(false);
  });
});

describe('maxSpeedAt', () => {
  it('adds 1 when descending, by one or two levels, and subtracts 1 when climbing', () => {
    expect(maxSpeedAt(spit({altitude: ALT_LOW}), ALT_VERY_LOW)).toBe(7);
    expect(maxSpeedAt(spit({altitude: ALT_LOW}), ALT_LOWEST)).toBe(7);
    expect(maxSpeedAt(spit({altitude: ALT_LOW}), ALT_LOW)).toBe(6);
    expect(maxSpeedAt(spit({altitude: ALT_LOW}), ALT_HIGH)).toBe(5);
  });

  it('the top altitude carries no counter (4.2.4)', () => {
    expect(maxSpeedAt(spit(), ALT_VERY_HIGH)).toBe(6);
  });
});

describe('movesMapFor', () => {
  it('range follows the chosen altitude', () => {
    // direction 0 advances B by one per hex
    expect(movesMapFor(spit(), {})).not.toHaveProperty(["A20.B27"]);
    expect(movesMapFor(spit(), {}, ALT_HIGH)).toHaveProperty(["A20.B27"]);
    expect(movesMapFor(spit({altitude: ALT_HIGH}), {})).toHaveProperty(["A20.B26"]);
    expect(movesMapFor(spit({altitude: ALT_HIGH}), {}, ALT_VERY_HIGH)).not.toHaveProperty(["A20.B26"]);
  });

  describe('4.1.1 occupied hexes', () => {
    const at = "A20.B23";

    it('cannot enter or fly through a hex occupied at the same altitude', () => {
      const moves = movesMapFor(spit(), {[R_Amer]: [he111({at})]});
      expect(moves).not.toHaveProperty([at]);
      expect(moves).not.toHaveProperty(["A20.B24"]);
    });

    it('also applies to friendly planes', () => {
      const moves = movesMapFor(spit(), {[R_Jap]: [spit({id: "1.1", at})]});
      expect(moves).not.toHaveProperty([at]);
    });

    it('allows a hex occupied at another altitude', () => {
      const moves = movesMapFor(spit(), {[R_Amer]: [he111({at, altitude: ALT_HIGH})]});
      expect(moves).toHaveProperty([at]);
      expect(moves).toHaveProperty(["A20.B24"]);
    });

    it('checks the altitude the plane will end its move at', () => {
      const moves = movesMapFor(spit(), {[R_Amer]: [he111({at, altitude: ALT_HIGH})]}, ALT_HIGH);
      expect(moves).not.toHaveProperty([at]);
    });

    it('ignores destroyed planes', () => {
      const moves = movesMapFor(spit(), {[R_Amer]: [he111({at, destroyed: true})]});
      expect(moves).toHaveProperty([at]);
    });

    it('can turn away before the occupied hex', () => {
      const free = movesMapFor(spit(), {});
      const turned = Object.keys(free).find(hex => free[hex] !== 0)!;
      const moves = movesMapFor(spit(), {[R_Amer]: [he111({at})]});
      expect(moves).toHaveProperty([turned]);
    });

    it('cannot turn into an occupied hex or past it', () => {
      const moves = movesMapFor(spit(), {[R_Amer]: [he111({at: "A22.B23"})]});
      expect(moves).not.toHaveProperty(["A22.B23"]);
      expect(moves).not.toHaveProperty(["A23.B24"]);
    });
  });
});

describe('4.2.1 altitude change on any hex of the way', () => {
  // direction 0: A20.B21, A20.B22, ...

  it('passes under a plane by descending before its hex', () => {
    const moves = movesMapFor(spit(), {[R_Amer]: [he111({at: "A20.B22", altitude: ALT_VERY_HIGH})]}, ALT_HIGH);
    expect(moves).toHaveProperty(["A20.B22"]);
    expect(moves).toHaveProperty(["A20.B23"]);
  });

  it('passes a plane at the new altitude by descending after its hex', () => {
    const moves = movesMapFor(spit(), {[R_Amer]: [he111({at: "A20.B22", altitude: ALT_HIGH})]}, ALT_HIGH);
    expect(moves).not.toHaveProperty(["A20.B22"]);
    expect(moves).toHaveProperty(["A20.B23"]);
  });

  it('changes the altitude only once', () => {
    // old altitude blocked first, then the new one: no hex to change on
    const blocked = [he111({at: "A20.B22", altitude: ALT_VERY_HIGH}), he111({id: "0.1", at: "A20.B23", altitude: ALT_HIGH})];
    const moves = movesMapFor(spit(), {[R_Amer]: blocked}, ALT_HIGH);
    expect(moves).toHaveProperty(["A20.B22"]);
    expect(moves).not.toHaveProperty(["A20.B23"]);
    expect(moves).not.toHaveProperty(["A20.B24"]);
    // the new altitude blocked first, then the old one: change between them
    const passable = [he111({at: "A20.B22", altitude: ALT_HIGH}), he111({id: "0.1", at: "A20.B23", altitude: ALT_VERY_HIGH})];
    expect(movesMapFor(spit(), {[R_Amer]: passable}, ALT_HIGH)).toHaveProperty(["A20.B24"]);
  });

  it('cannot pass at an unchanged altitude', () => {
    const moves = movesMapFor(spit(), {[R_Amer]: [he111({at: "A20.B22", altitude: ALT_VERY_HIGH})]});
    expect(moves).not.toHaveProperty(["A20.B23"]);
  });

  it('applies to the ways off the board', () => {
    const plane = spit({at: "A20.B44"});
    const blocker = he111({at: "A20.B46", altitude: ALT_VERY_HIGH});
    const exit = {hex: "A20.B47", edge: "N"};
    expect(exitsFor(plane, {})).toContainEqual(exit);
    expect(exitsFor(plane, {[R_Amer]: [blocker]})).not.toContainEqual(exit);
    expect(exitsFor(plane, {[R_Amer]: [blocker]}, ALT_HIGH)).toContainEqual(exit);
  });
});

describe('fire across altitudes', () => {
  it('firstOnFireLine ignores planes at another altitude', () => {
    const target = he111({altitude: ALT_HIGH});
    const board = {[R_Jap]: [spit()], [R_Amer]: [target]};
    expect(firstOnFireLine(spit(), board)).toBeNull();
    expect(firstOnFireLine(spit({altitude: ALT_HIGH}), board)?.plane).toBe(target);
  });

  it('a plane at another altitude does not block the line', () => {
    const blocker = he111({id: "0.1", at: "A20.B21", altitude: ALT_HIGH});
    const target = he111();
    const board = {[R_Jap]: [spit()], [R_Amer]: [blocker, target]};
    expect(firstOnFireLine(spit(), board)?.plane).toBe(target);
  });

  it('planesInFirelane counts only shooters at the same altitude', () => {
    G.board = {planes: {[R_Jap]: [spit()], [R_Amer]: [he111({altitude: ALT_HIGH})]}};
    expect(planesInFirelane(R_Amer)).toEqual([]);
    G.board = {planes: {[R_Jap]: [spit({altitude: ALT_HIGH})], [R_Amer]: [he111({altitude: ALT_HIGH})]}};
    expect(planesInFirelane(R_Amer).map(it => it.id)).toEqual(["0.0"]);
  });
});
