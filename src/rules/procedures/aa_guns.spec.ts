import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, L, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {ALT_LOW, ALT_VERY_LOW} from "../game/altitude";
import {on_setup} from "../lifecycle/on_setup";
import {placeAaGuns} from "./aa_guns";
import {combat} from "./combat";
import {movePlanes} from "./move_planes";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
  L: {},
  V: {unmoved: []},
}));

const GUN = "A05.B05"
const ADJACENT = "A05.B06"
const FAR = "A05.B07"
const SEA = "A20.B20"
const CLOUD = "A33.B28"
const CLOUD_EDGE = "A33.B24"

const goto = vi.fn();
let dice: number[];
const roll = (value: number) => dice = [value - 1];

function he111(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane: planes.HE111, at: GUN, direction: 3, altitude: ALT_LOW, ...overrides}
}

function setup(niem: PlaneInstance[], guns = [GUN], active = R_Jap) {
  Object.assign(G, {
    active, shot: [], moved: [], targets: [], bombed: [], flown_over: {}, aa_guns: guns, aa_fired: [],
    board: {planes: {[R_Amer]: niem, [R_Jap]: []}},
  });
  delete G.selected_plane;
  delete G.selected_gun;
  delete G.sun;
}

function actions(state: { prompt(): void }) {
  const action = vi.fn();
  vi.stubGlobal("prompt", vi.fn());
  vi.stubGlobal("button", vi.fn());
  vi.stubGlobal("action", action);
  state.prompt();
  return action.mock.calls;
}

function shoot(plane: PlaneInstance, value: number, gun = GUN) {
  roll(value);
  G.selected_gun = gun;
  combat.aa_fire(plane.id);
}

beforeEach(() => {
  goto.mockClear();
  stubFramework({goto, random: () => dice.shift()});
});

describe('setup (6)', () => {
  it('rolls the edge of the sun (5.0.1)', () => {
    roll(5);
    on_setup("Wariant 1", undefined);
    expect(G.sun).toBe("W");
  });

  it('starts with the British placing the guns of the scenario', () => {
    roll(1);
    on_setup("Wariant 3", undefined);
    expect(G.active).toBe(R_Jap);
    expect(call).toHaveBeenCalledWith("place_aa_guns", {count: 12});
  });

  it('is skipped in a scenario without guns', () => {
    roll(1);
    on_setup("Wariant 1", undefined);
    expect(G.active).toBe(R_Jap);
    expect(call).toHaveBeenCalledWith("place_planes");
  });

  it('allows one gun per hex, on land only (6.1.2)', () => {
    Object.assign(L, {count: 5});
    setup([], []);
    for (const hex of [GUN, GUN, SEA, CLOUD, CLOUD_EDGE]) placeAaGuns.place_gun(hex);
    expect(G.aa_guns).toEqual([GUN]);
    const offered = actions(placeAaGuns).map(it => it[1]);
    expect(offered).not.toContain(GUN);
    expect(offered).not.toContain(SEA);
    expect(offered).not.toContain(CLOUD);
    expect(offered).not.toContain(CLOUD_EDGE);
    expect(offered).toContain(ADJACENT);
  });

  it('ends only with all the guns placed, then the British set up their planes', () => {
    Object.assign(L, {count: 2});
    setup([], [GUN]);
    placeAaGuns.done();
    expect(goto).not.toHaveBeenCalled();
    placeAaGuns.place_gun(ADJACENT);
    placeAaGuns.place_gun(FAR);
    expect(G.aa_guns).toHaveLength(2);
    placeAaGuns.done();
    expect(G.active).toBe(R_Jap);
    expect(goto).toHaveBeenCalledWith("place_planes");
  });
});

describe('firing table (table 4)', () => {
  it.each([
    ["high, same hex", 0, GUN, 5, 6],
    ["low, same hex", ALT_LOW, GUN, 4, 5],
    ["low, adjacent", ALT_LOW, ADJACENT, 5, 6],
    ["very low, same hex", ALT_VERY_LOW, GUN, 3, 4],
    ["very low, adjacent", ALT_VERY_LOW, ADJACENT, 4, 5],
  ])('%s', (_name, altitude, at, miss, hit) => {
    const missed = he111({altitude, at});
    setup([missed]);
    shoot(missed, miss);
    expect(missed.damaged).toBeUndefined();

    const target = he111({altitude, at});
    setup([target]);
    shoot(target, hit);
    expect(target.damaged).toBe(true);
  });

  it('cannot reach a high plane on an adjacent hex, nor anything further', () => {
    setup([he111({altitude: 0, at: ADJACENT}), he111({id: "0.1", altitude: ALT_VERY_LOW, at: FAR})]);
    expect(actions(combat)).toEqual([]);
  });

  it('cannot hit in clouds (6.2.5)', () => {
    setup([he111({altitude: 0, at: CLOUD})], [CLOUD]);
    expect(actions(combat)).toEqual([]);
  });

  it('destroys a plane that was already damaged (6.1)', () => {
    const target = he111({damaged: true});
    setup([target]);
    shoot(target, 6);
    expect(target.destroyed).toBe(true);
  });
});

describe('firing', () => {
  it('stops at the combat phase when only a gun can act (6.1)', () => {
    setup([he111()]);
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("combat");
    expect(G.active).toBe(R_Jap);
  });

  it('is not possible in the German combat phase (6.1)', () => {
    setup([he111()], [GUN], R_Amer);
    // A British plane on the board, or their movement phase would be skipped.
    G.board.planes[R_Jap].push({id: "1.0", plane: planes.Spit, at: "A40.B40", direction: 0});
    expect(actions(combat)).toEqual([]);
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("move_planes");
  });

  it('offers the guns, and the targets of the selected one', () => {
    setup([he111(), he111({id: "0.1", at: FAR})], [GUN]);
    expect(actions(combat)).toEqual([["select_gun", GUN]]);
    combat.select_gun(GUN);
    expect(actions(combat)).toEqual([["select_gun", GUN], ["aa_fire", "0.0"]]);
  });

  it('selecting a plane drops the gun, and the other way around', () => {
    setup([he111()]);
    combat.select_gun(GUN);
    combat.select_plane("1.0");
    expect(G.selected_gun).toBeUndefined();
    combat.select_gun(GUN);
    expect(G.selected_plane).toBeUndefined();
    expect(G.selected_gun).toBe(GUN);
  });

  it('one shot per gun (6.2.1), renewed with the next stage', () => {
    const target = he111();
    setup([target]);
    shoot(target, 1);
    expect(actions(combat)).toEqual([]);
    roll(6);
    G.selected_gun = GUN;
    combat.aa_fire(target.id);
    expect(target.damaged).toBeUndefined();
    combat.done();
    expect(G.aa_fired).toEqual([]);
  });

  it('many guns can fire at one plane (6.2.2)', () => {
    const target = he111();
    setup([target], [GUN, ADJACENT]);
    shoot(target, 5);
    shoot(target, 6, ADJACENT);
    expect(target.destroyed).toBe(true);
  });

  it('can be declined (6.2.4)', () => {
    setup([he111()]);
    combat.done();
    expect(G.active).toBe(R_Amer);
  });
});

describe('bombing a gun (6.2.6, 7.0.6)', () => {
  function bomb(value: number) {
    setup([he111()], [ADJACENT], R_Amer);
    G.moved = ["0.0"];
    G.flown_over = {"0.0": [ADJACENT]};
    G.selected_plane = "0.0";
    roll(value);
    movePlanes.bomb(ADJACENT);
  }

  it('offers a hex with a gun, without marking it as a bombed target', () => {
    setup([he111()], [ADJACENT], R_Amer);
    G.moved = ["0.0"];
    G.flown_over = {"0.0": [ADJACENT]};
    G.selected_plane = "0.0";
    expect(actions(movePlanes).filter(it => it[0] === "bomb")).toEqual([["bomb", ADJACENT]]);
    roll(1);
    movePlanes.bomb(ADJACENT);
    expect(G.bombed).toEqual([]);
  });

  it('destroys the gun on 4-6', () => {
    bomb(4);
    expect(G.aa_guns).toEqual([]);
    expect(clear_undo).toHaveBeenCalled();
  });

  it('leaves it on 1-3', () => {
    bomb(3);
    expect(G.aa_guns).toEqual([ADJACENT]);
  });
});
