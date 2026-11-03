import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, planes, R_Amer, R_Jap} from "../globals";
import type {PlaneInstance, StageFlight} from "../types";
import type {PlaneData} from "../game/data";
import {flightsFor} from "../game/hex";
import {attackDamage} from "../game/bombs";
import {shipHexes} from "../game/ships";
import {combat} from "./combat";
import {movePlanes} from "./move_planes";
import {bombableHexes, bombingKind, torpedoHexes} from "./bombers";
import {startCombat} from "./phases";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
  L: {},
  V: {unmoved: []},
}));

const N = 0
const goto = vi.fn();
let dice: number[];
// 2d6 summing up to the value.
const roll = (value: number) => dice = [Math.ceil(value / 2) - 1, Math.floor(value / 2) - 1];

const TARGET = "A20.B23"
const SHIP = ["A20.B25", "A20.B26", "A20.B27", "A20.B28"]

function bomber(plane: PlaneData, overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane, at: "A20.B24", direction: N, ...overrides}
}

function flight(overrides: Partial<StageFlight> = {}): StageFlight {
  return {path: ["A20.B21", "A20.B22", TARGET, "A20.B24", ...SHIP], from_altitude: 5, altitude: 5, straight: true, ...overrides}
}

function setup(plane: PlaneInstance, stageFlight = flight()) {
  for (const key of Object.keys(G)) delete (G as any)[key];
  Object.assign(G, {
    active: R_Amer, stage: 1, shot: [], moved: [], targets: [TARGET], bombed: [], aa_guns: [],
    flights: {[plane.id]: stageFlight},
    ships: [{id: "1.s0", side: R_Jap, type: "SHOHO", nazwa: "Shoho", hexes: SHIP}],
    board: {planes: {[R_Amer]: [plane], [R_Jap]: [{id: "1.0", plane: planes.A6M, at: "A50.B50", direction: 0}]}},
  });
  G.selected_plane = plane.id;
}

function actions() {
  const action = vi.fn();
  vi.stubGlobal("prompt", vi.fn());
  vi.stubGlobal("button", vi.fn());
  vi.stubGlobal("action", action);
  combat.prompt();
  return action.mock.calls.filter(([name]) => name === "bomb" || name === "torpedo");
}

beforeEach(() => {
  goto.mockClear();
  stubFramework({goto, random: () => dice.shift()});
});

it('the flight path lists the hexes entered, without the starting one', () => {
  const plane = bomber(planes.SBD, {at: "A20.B20"});
  const flights = flightsFor(plane, {[R_Amer]: [plane]});
  expect(flights["A20.B23"]).toEqual({direction: 0, path: ["A20.B21", "A20.B22", "A20.B23"]});
});

it('movement records the flight of the stage', () => {
  const plane = bomber(planes.SBD, {at: "A20.B20", altitude: 3});
  setup(plane);
  G.flights = {};
  G.selected_altitude = 1;
  movePlanes.move_hex("A20.B23");
  expect(G.flights["0.0"]).toEqual({path: ["A20.B21", "A20.B22", "A20.B23"], from_altitude: 3, altitude: 1, straight: true});
});

describe('7.1: the kind of bombing', () => {
  it('level: at altitude 4 or 5, without changing it', () => {
    expect(bombingKind(bomber(planes.B17))).toBeNull();
    setup(bomber(planes.B17));
    expect(bombingKind(bomber(planes.B17))).toBe("poziome");
    setup(bomber(planes.B17), flight({from_altitude: 4, altitude: 4}));
    expect(bombingKind(bomber(planes.B17))).toBe("poziome");
    setup(bomber(planes.B17), flight({from_altitude: 5, altitude: 4}));
    expect(bombingKind(bomber(planes.B17))).toBeNull();
    setup(bomber(planes.B17), flight({from_altitude: 3, altitude: 3}));
    expect(bombingKind(bomber(planes.B17))).toBeNull();
  });

  it('dive: down from 3 to 1, by the dive bombers only', () => {
    setup(bomber(planes.SBD), flight({from_altitude: 3, altitude: 1}));
    expect(bombingKind(bomber(planes.SBD))).toBe("nurkowe");
    setup(bomber(planes.B25), flight({from_altitude: 3, altitude: 1}));
    expect(bombingKind(bomber(planes.B25))).toBeNull();
  });

  it('none with a torpedo on board', () => {
    const plane = bomber({...planes.TBF, torpeda: true});
    setup(plane);
    expect(bombingKind(plane)).toBeNull();
  });
});

describe('bombing (7.0)', () => {
  it('happens in the combat phase, which a bomber keeps open', () => {
    const plane = bomber(planes.B17);
    setup(plane);
    delete G.selected_plane;
    startCombat();
    expect(goto).toHaveBeenCalledWith("combat");
  });

  it('offers the targets and ships flown over (7.0.1-7.0.3)', () => {
    setup(bomber(planes.B17));
    expect(actions().map(it => it[1])).toEqual(["bomb", "bomb", "bomb", "bomb", "bomb"].map((_, i) => [TARGET, ...SHIP][i]));
  });

  it('hits a ship with the damage of table 6', () => {
    const plane = bomber(planes.B17);
    setup(plane);
    roll(11);
    combat.bomb(SHIP[0]);
    expect(G.ships![0].damage).toBe(3);
    expect(plane.bombs_dropped).toBe(1);
  });

  it('bombs a hex once per stage (7.0.4), and as many as the load allows (7.0.5)', () => {
    const plane = bomber({...planes.B25, udzwig_bomb: 2});
    setup(plane);
    roll(2);
    combat.bomb(SHIP[0]);
    expect(bombableHexes(plane)).not.toContain(SHIP[0]);
    roll(2);
    combat.bomb(SHIP[1]);
    expect(bombableHexes(plane)).toEqual([]);
  });

  it('a strategic object counts as bombed after a hit (scenarios 2, 6)', () => {
    setup(bomber(planes.B17));
    roll(8);
    combat.bomb(TARGET);
    expect(G.bombed).toEqual([]);
    setup(bomber(planes.B17));
    roll(9);
    combat.bomb(TARGET);
    expect(G.bombed).toEqual([TARGET]);
  });

  it('under AA fire uses the other column (7.2)', () => {
    const plane = bomber(planes.SBD, {under_fire: true});
    setup(plane, flight({from_altitude: 3, altitude: 1}));
    roll(7);
    combat.bomb(SHIP[0]);
    expect(G.ships![0].damage).toBe(1);
  });

  it('sinks a ship once its endurance is gone (2.3)', () => {
    setup(bomber(planes.B17));
    G.ships![0].damage = 11;
    roll(12);
    combat.bomb(SHIP[0]);
    expect(G.ships![0].sunk).toBe(true);
    expect(bombableHexes(bomber(planes.B17))).toEqual([TARGET]);
  });
});

describe('bombing a gun (7.0.6)', () => {
  const GUN = "A20.B22"

  function bomb(value: number) {
    setup(bomber(planes.B17));
    G.aa_guns = [{hex: GUN, side: R_Jap, heavy: true}];
    dice = [value - 1];
    combat.bomb(GUN);
  }

  it('destroys the gun on 4-6', () => {
    bomb(4);
    expect(G.aa_guns).toEqual([]);
    expect(clear_undo).toHaveBeenCalled();
  });

  it('leaves it on 1-3', () => {
    bomb(3);
    expect(G.aa_guns).toHaveLength(1);
  });
});

describe('torpedo attack (7.3)', () => {
  const torpedo = (overrides: Partial<PlaneInstance> = {}) => bomber({...planes.TBF, torpeda: true}, overrides);
  const low = flight({from_altitude: 1, altitude: 1});

  it('at the first ship 1-3 hexes straight ahead, after a straight flight at the lowest altitude', () => {
    setup(torpedo(), low);
    expect(torpedoHexes(torpedo())).toEqual([SHIP[0]]);
    expect(torpedoHexes(torpedo({at: "A20.B21"}))).toEqual([]);
    setup(torpedo(), flight({from_altitude: 1, altitude: 1, straight: false}));
    expect(torpedoHexes(torpedo())).toEqual([]);
    setup(torpedo(), flight({from_altitude: 2, altitude: 1}));
    expect(torpedoHexes(torpedo())).toEqual([]);
  });

  it('damages by table 8', () => {
    const plane = torpedo();
    setup(plane, low);
    roll(10);
    combat.torpedo(SHIP[0]);
    expect(G.ships![0].damage).toBe(6);
    expect(torpedoHexes(plane)).toEqual([]);
  });
});

describe('tables 6-8', () => {
  it.each([
    ["poziome", false, [8, 9, 10, 11, 12], [0, 1, 2, 3, 4]],
    ["poziome", true, [9, 10, 11, 12], [0, 1, 2, 3]],
    ["nurkowe", false, [5, 6, 7, 8, 9, 10, 12], [0, 1, 2, 3, 3, 4, 4]],
    ["nurkowe", true, [6, 7, 8, 9, 10, 11, 12], [0, 1, 1, 2, 2, 3, 3]],
    ["torpeda", false, [6, 7, 8, 9, 10, 11, 12], [0, 3, 5, 5, 6, 6, 7]],
    ["torpeda", true, [8, 9, 10, 11, 12], [0, 3, 5, 5, 6]],
  ] as const)('%s, under fire: %s', (kind, underFire, rolls, damage) => {
    expect(rolls.map(it => attackDamage(kind, underFire, it))).toEqual(damage);
  });
});

it('a ship takes as many hexes as table 3 says, from the scenario hex towards the other one (9)', () => {
  expect(shipHexes("A10.B27", "A12.B27", 2)).toEqual(["A10.B27", "A11.B27"]);
  expect(shipHexes("A42.B39", "A46.B39", 5)).toEqual(["A42.B39", "A43.B39", "A44.B39", "A45.B39", "A46.B39"]);
});
