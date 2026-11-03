import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, L, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {movedIntoFirelane, returnFire} from "./moved_into_firelane";
import {movePlanes} from "./move_planes";
import {combat} from "./combat";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
  L: {},
  V: {},
}));

const goto = vi.fn((_name: string, env?: object) => Object.assign(L, env));
let dice: number[];

// A plane with no rear guns: fire lines cross only when it faces the other plane.
function he111(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane: planes.F4F, at: "A20.B21", direction: 0, ...overrides}
}

function spit(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "1.0", plane: planes.A6M6, at: "A20.B20", direction: 0, ...overrides}
}

function setup(niem: PlaneInstance[], bryt: PlaneInstance[], active = R_Jap) {
  Object.assign(G, {active, shot: [], moved: [], board: {planes: {[R_Amer]: niem, [R_Jap]: bryt}}});
  delete G.selected_plane;
}

// Each die is rolled as random(6) + 1
const roll = (...values: number[]) => dice = values.map(it => it - 1);

beforeEach(() => {
  goto.mockClear();
  stubFramework({goto, random: () => dice.shift()});
});

describe('moving into a fire line', () => {
  it('gives the enemy the first shot', () => {
    setup([he111()], [spit()], R_Amer);
    movePlanes.done();
    expect(G.active).toBe(R_Jap);
    expect(goto).toHaveBeenCalledWith("moved_into_firelane");
  });

  it('does not react when the fire line is blocked by a friendly plane (5.3.2)', () => {
    setup([he111({at: "A20.B22"})], [spit(), spit({id: "1.1", at: "A20.B21", direction: 3})], R_Amer);
    movePlanes.done();
    expect(goto).not.toHaveBeenCalledWith("moved_into_firelane");
  });

  it('jammed planes cannot react, but get to clear their guns (5.3.4)', () => {
    setup([he111({jammed: true})], [spit({jammed: true})], R_Amer);
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("combat");
    expect(G.active).toBe(R_Amer);
  });

  it('goes straight to the next move phase when nobody can act', () => {
    setup([he111({at: "A30.B30"})], [spit()], R_Amer);
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("move_planes");
    expect(G.active).toBe(R_Jap);
  });
});

describe('reaction fire', () => {
  // Gives the He 111 a target of its own, so that its side has a combat phase.
  const ahead = spit({id: "1.1", at: "A20.B24"});

  it('applies the hit before the moving side attacks and passes the turn back', () => {
    const target = he111();
    setup([target], [spit(), ahead]);
    G.selected_plane = "1.0";
    roll(3, 5); // Zero atk 4, distance 1: 8-9 gives 2 damage
    movedIntoFirelane.attack();
    expect(target.damage).toBe(2);
    expect(G.shot).toEqual(["1.0"]);
    expect(G.active).toBe(R_Amer);
    expect(goto).toHaveBeenCalledWith("combat");
  });

  it('a plane that reacted can still fire in its own combat phase (3.0)', () => {
    setup([he111()], [spit()]);
    G.selected_plane = "1.0";
    roll(1, 2);
    movedIntoFirelane.attack();
    expect(G.active).toBe(R_Jap);
    expect(goto).toHaveBeenLastCalledWith("move_planes");
    expect(G.shot).toEqual([]);
    goto.mockClear();
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("combat");
    expect(G.active).toBe(R_Jap);
  });

  it('a damaged plane fires with the reduced attack (2.1.1)', () => {
    const target = he111();
    setup([target], [spit({damaged: true})]);
    G.selected_plane = "1.0";
    roll(3, 3); // reduced Zero atk 3, distance 1: from 7
    movedIntoFirelane.attack();
    expect(target.damage).toBeUndefined();
  });

  it('works in a game saved without the list of planes that fired', () => {
    setup([he111()], [spit(), ahead]);
    delete G.shot;
    G.selected_plane = "1.0";
    roll(1, 2);
    movedIntoFirelane.attack();
    expect(G.shot).toEqual(["1.0"]);
  });

  it('can be declined (5.3.6)', () => {
    setup([he111()], [spit(), ahead]);
    movedIntoFirelane.done();
    expect(G.shot).toEqual([]);
    expect(G.active).toBe(R_Amer);
    expect(goto).toHaveBeenCalledWith("combat");
  });
});

describe('combat phase', () => {
  it('offers only planes that can still act (5.3.1, 5.3.4)', () => {
    const action = vi.fn();
    vi.stubGlobal("prompt", vi.fn());
    vi.stubGlobal("button", vi.fn());
    vi.stubGlobal("action", action);
    setup([he111()], [
      spit(),
      spit({id: "1.1", at: "A20.B19"}),
      spit({id: "1.2", at: "A30.B30"}),
      spit({id: "1.3", at: "A40.B40", jammed: true}),
    ]);
    G.shot = ["1.1"];
    combat.prompt();
    expect(action.mock.calls.map(it => it[1])).toEqual(["1.0", "1.3"]);
  });
});

describe('coinciding fire lines', () => {
  function mutual() {
    // One more point of damage shoots either down.
    const a = he111({direction: 3, damaged: true, damage: 5});
    const b = spit({damaged: true, damage: 5});
    setup([a], [b]);
    G.selected_plane = "1.0";
    roll(4, 4); // reduced Zero atk 3, distance 1: 7-8 gives 1 damage
    movedIntoFirelane.attack();
    return {a, b};
  }

  it('lets the target shoot back before the hit takes effect', () => {
    const {a} = mutual();
    expect(a.destroyed).toBeUndefined();
    expect(G.active).toBe(R_Amer);
    expect(goto).toHaveBeenCalledWith("return_fire", {shooter: "1.0", target: "0.0", damage: 1, downed: false});
  });

  it('both planes can go down', () => {
    const {a, b} = mutual();
    roll(5, 5); // reduced Wildcat atk 3, distance 1: 9-10 gives 2 damage
    returnFire.attack();
    expect(a.destroyed).toBe(true);
    expect(b.destroyed).toBe(true);
  });

  it('returning fire uses up the shot of that combat phase (5.3.1)', () => {
    setup([he111({direction: 3})], [spit()]);
    G.selected_plane = "1.0";
    roll(4, 4); // Zero atk 4, distance 1: from 6
    movedIntoFirelane.attack();
    roll(1, 2);
    returnFire.attack();
    expect(goto).not.toHaveBeenCalledWith("combat");
    expect(goto).toHaveBeenLastCalledWith("move_planes");
  });

  it('the hit still lands when the target holds its fire', () => {
    const {a, b} = mutual();
    returnFire.done();
    expect(a.destroyed).toBe(true);
    expect(b.destroyed).toBeUndefined();
  });

  it('a miss needs no return fire: the target attacks in its own phase', () => {
    setup([he111({direction: 3})], [spit()]);
    G.selected_plane = "1.0";
    roll(1, 2);
    movedIntoFirelane.attack();
    expect(goto).toHaveBeenCalledWith("combat");
  });
});
