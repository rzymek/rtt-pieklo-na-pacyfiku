import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, L, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {ALT_LOWEST, ALT_VERY_HIGH, ALT_VERY_LOW} from "../game/altitude";
import {on_setup} from "../lifecycle/on_setup";
import {antiAircraft, placeAaGuns} from "./aa_guns";
import {endMovement} from "./phases";
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
  return {id: "0.0", plane: planes.SBD, at: GUN, direction: 3, altitude: ALT_VERY_LOW, ...overrides}
}

function setup(niem: PlaneInstance[], guns = [GUN], active = R_Jap) {
  for (const key of Object.keys(G)) delete (G as any)[key];
  Object.assign(G, {
    active, stage: 1, shot: [], moved: [], targets: [], bombed: [], flown_over: {}, aa_guns: guns, aa_fired: [],
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
  antiAircraft.aa_fire(plane.id);
}

beforeEach(() => {
  goto.mockClear();
  stubFramework({goto, random: () => dice.shift()});
});

describe('setup (6)', () => {
  it('rolls the edge of the sun (5.0.1)', () => {
    roll(5);
    on_setup("1. Atak na Pearl Harbor", undefined);
    expect(G.sun).toBe("W");
  });

  it('starts with the Japanese placing the guns of the scenario', () => {
    roll(1);
    on_setup("2. Kampania powietrzna na Filipinach", undefined);
    expect(G.active).toBe(R_Jap);
    expect(call).toHaveBeenCalledWith("place_aa_guns", {count: 8});
  });

  it('is skipped in a scenario without guns', () => {
    roll(1);
    on_setup("1. Atak na Pearl Harbor", undefined);
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
    ["high, same hex", ALT_VERY_HIGH, GUN, 5, 6],
    ["low, same hex", ALT_VERY_LOW, GUN, 4, 5],
    ["low, adjacent", ALT_VERY_LOW, ADJACENT, 5, 6],
    ["very low, same hex", ALT_LOWEST, GUN, 3, 4],
    ["very low, adjacent", ALT_LOWEST, ADJACENT, 4, 5],
  ])('%s', (_name, altitude, at, miss, hit) => {
    const missed = he111({altitude, at});
    setup([missed]);
    shoot(missed, miss);
    expect(missed.damage).toBeUndefined();

    const target = he111({altitude, at});
    setup([target]);
    shoot(target, hit);
    expect(target.damage).toBeGreaterThan(0);
  });

  it('cannot reach a high plane on an adjacent hex, nor anything further', () => {
    setup([he111({altitude: ALT_VERY_HIGH, at: ADJACENT}), he111({id: "0.1", altitude: ALT_LOWEST, at: FAR})]);
    expect(actions(antiAircraft)).toEqual([]);
  });

  it('cannot hit in clouds (6.2.5)', () => {
    setup([he111({altitude: ALT_VERY_HIGH, at: CLOUD})], [CLOUD]);
    expect(actions(antiAircraft)).toEqual([]);
  });

  it('destroys a plane with too little endurance left (2.2)', () => {
    const target = he111({damaged: true, damage: 5});
    setup([target]);
    shoot(target, 6);
    expect(target.destroyed).toBe(true);
  });
});

describe('firing (6.2)', () => {
  it('follows the American movement (phase 2)', () => {
    setup([he111()], [GUN], R_Amer);
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("anti_aircraft");
    expect(G.active).toBe(R_Jap);
  });

  it('is followed by the enemy fire at the planes on its fire line (5.4), then the American combat (phase 3)', () => {
    setup([he111()], [GUN], R_Amer);
    // Facing south, from 2 hexes north of the target.
    G.board.planes[R_Jap].push({id: "1.0", plane: planes.A6M6, at: "A05.B07", direction: 3, altitude: ALT_VERY_LOW});
    movePlanes.done();
    expect(goto).toHaveBeenLastCalledWith("anti_aircraft");
    antiAircraft.done();
    expect(goto).toHaveBeenLastCalledWith("moved_into_firelane");
    expect(G.active).toBe(R_Jap);
  });

  it('has no guns to fire after the Japanese movement (phase 5)', () => {
    setup([he111()], [GUN], R_Jap);
    G.board.planes[R_Jap].push({id: "1.0", plane: planes.A6M6, at: "A40.B40", direction: 0});
    movePlanes.done();
    expect(goto).not.toHaveBeenCalledWith("anti_aircraft");
  });

  it('offers the guns, and the targets of the selected one', () => {
    setup([he111(), he111({id: "0.1", at: FAR})], [GUN]);
    expect(actions(antiAircraft)).toEqual([["select_gun", GUN]]);
    antiAircraft.select_gun(GUN);
    expect(actions(antiAircraft)).toEqual([["select_gun", GUN], ["aa_fire", "0.0"]]);
  });

  it('one shot per gun in a stage (6.3.1), renewed in the next AA phase', () => {
    const target = he111();
    setup([target]);
    shoot(target, 1);
    expect(G.aa_fired).toEqual([GUN]);
    expect(actions(antiAircraft)).toEqual([]);
    roll(6);
    G.selected_gun = GUN;
    antiAircraft.aa_fire(target.id);
    expect(target.damaged).toBeUndefined();
    G.active = R_Amer;
    endMovement();
    expect(G.aa_fired).toEqual([]);
    expect(goto).toHaveBeenCalledWith("anti_aircraft");
  });

  it('ends the phase once no gun has a target left', () => {
    const target = he111();
    setup([target]);
    shoot(target, 1);
    expect(goto).not.toHaveBeenCalledWith("anti_aircraft");
    expect(G.active).not.toBe(R_Jap);
  });

  it('many guns can fire at one plane (6.3.2)', () => {
    const target = he111();
    setup([target], [GUN, ADJACENT]);
    shoot(target, 5);
    shoot(target, 6, ADJACENT);
    expect(target.damage).toBe(2);
  });

  it('can be declined (6.3.4)', () => {
    const target = he111();
    setup([target]);
    antiAircraft.done();
    expect(target.damaged).toBeUndefined();
    expect(G.aa_fired).toEqual([]);
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
