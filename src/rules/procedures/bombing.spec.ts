import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {flightsFor} from "../game/hex";
import {combat} from "./combat";
import {movePlanes} from "./move_planes";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
  L: {},
  V: {unmoved: []},
}));

const goto = vi.fn();
const log = vi.fn();

function he111(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "0.0", plane: planes.SBD, at: "A20.B20", direction: 0, ...overrides}
}

function spit(overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id: "1.0", plane: planes.A6M6, at: "A01.B01", direction: 0, ...overrides}
}

function setup(niem: PlaneInstance[], flownOver: Record<string, string[]> = {}, moved: string[] = []) {
  Object.assign(G, {
    active: R_Amer,
    shot: [],
    moved,
    targets: ["A20.B21", "A20.B22", "A20.B23", "A30.B30"],
    bombed: [],
    flown_over: flownOver,
    board: {planes: {[R_Amer]: niem, [R_Jap]: [spit()]}},
  });
  delete G.selected_plane;
}

function actionsOf(prompt: () => void) {
  const action = vi.fn();
  vi.stubGlobal("prompt", vi.fn());
  vi.stubGlobal("button", vi.fn());
  vi.stubGlobal("action", action);
  prompt();
  return action.mock.calls;
}

beforeEach(() => {
  goto.mockClear();
  log.mockClear();
  stubFramework({goto, log});
});

describe('flight path', () => {
  it('lists the hexes entered, without the starting one', () => {
    const flights = flightsFor(he111(), {[R_Amer]: [he111()]});
    expect(flights["A20.B23"]).toEqual({direction: 0, path: ["A20.B21", "A20.B22", "A20.B23"]});
  });

  it('follows the turn', () => {
    const flights = flightsFor(he111(), {[R_Amer]: [he111()]});
    expect(flights["A21.B23"]).toEqual({direction: 1, path: ["A20.B21", "A20.B22", "A21.B23"]});
  });
});

describe('moving', () => {
  it('remembers the hexes flown over (7.0.2)', () => {
    const plane = he111();
    setup([plane]);
    G.selected_plane = plane.id;
    movePlanes.move_hex("A20.B23");
    expect(G.flown_over).toEqual({"0.0": ["A20.B21", "A20.B22", "A20.B23"]});
  });
});

describe('after the move', () => {
  it('keeps a plane that can bomb selected (3.0)', () => {
    const plane = he111();
    setup([plane]);
    G.selected_plane = plane.id;
    movePlanes.move_hex("A20.B23");
    expect(G.selected_plane).toBe("0.0");
  });

  it('releases a plane that flew over no strategic object', () => {
    const plane = he111({at: "A30.B20"});
    setup([plane]);
    G.selected_plane = plane.id;
    movePlanes.move_hex("A30.B23");
    expect(G.selected_plane).toBeUndefined();
  });

  it('releases a plane that has no bombs left', () => {
    const plane = he111({bombs_dropped: 2});
    setup([plane]);
    G.selected_plane = plane.id;
    movePlanes.move_hex("A20.B23");
    expect(G.selected_plane).toBeUndefined();
  });

  it('releases a plane without a bomb load', () => {
    const plane = he111({plane: planes.F4F});
    setup([plane]);
    G.selected_plane = plane.id;
    movePlanes.move_hex("A20.B23");
    expect(G.selected_plane).toBeUndefined();
  });

  it('offers no more moves to a plane that already moved', () => {
    setup([he111()], {"0.0": ["A20.B21"]}, ["0.0"]);
    G.selected_plane = "0.0";
    expect(actionsOf(movePlanes.prompt).filter(it => it[0] === "move_hex")).toEqual([]);
  });
});

describe('leaving the movement phase', () => {
  it('does not stop in the attack phase for the bombs left unused (3.0)', () => {
    setup([he111()], {"0.0": ["A20.B21"]}, ["0.0"]);
    movePlanes.done();
    expect(goto).toHaveBeenCalledWith("move_planes");
  });

  it('forgets the flown over hexes', () => {
    setup([he111()], {"0.0": ["A20.B21"]}, ["0.0"]);
    movePlanes.done();
    expect(G.flown_over).toEqual({});
  });

  it('offers no bombing in the attack phase', () => {
    setup([he111()], {"0.0": ["A20.B21"]});
    G.selected_plane = "0.0";
    expect(actionsOf(combat.prompt).filter(it => it[0] === "bomb")).toEqual([]);
  });
});

describe('bombing', () => {
  const bombActions = () => actionsOf(movePlanes.prompt).filter(it => it[0] === "bomb");

  it('offers only the hexes flown over by the selected plane (7.0.2)', () => {
    setup([he111(), he111({id: "0.1"})], {"0.0": ["A20.B21", "A20.B22"], "0.1": ["A30.B30"]}, ["0.0", "0.1"]);
    expect(actionsOf(movePlanes.prompt)).toEqual([["select_plane", "0.0"], ["select_plane", "0.1"]]);
    G.selected_plane = "0.0";
    expect(bombActions()).toEqual([["bomb", "A20.B21"], ["bomb", "A20.B22"]]);
  });

  it('lets the next plane be selected without bombing', () => {
    setup([he111(), he111({id: "0.1"})], {"0.0": ["A20.B21"]}, ["0.0"]);
    G.selected_plane = "0.0";
    expect(actionsOf(movePlanes.prompt).filter(it => it[0] === "select_plane"))
      .toEqual([["select_plane", "0.0"], ["select_plane", "0.1"]]);
  });

  it('uses up one series and the hex (7.0, 7.0.4)', () => {
    const plane = he111();
    setup([plane], {"0.0": ["A20.B21", "A20.B22"]}, ["0.0"]);
    G.selected_plane = "0.0";
    movePlanes.bomb("A20.B21");
    expect(plane.bombs_dropped).toBe(1);
    expect(G.flown_over!["0.0"]).toEqual(["A20.B22"]);
    movePlanes.bomb("A20.B21");
    expect(plane.bombs_dropped).toBe(1);
  });

  it('is limited by the bomb load (7.0.5)', () => {
    const plane = he111({plane: planes.G4M});
    setup([plane], {"0.0": ["A20.B21", "A20.B22", "A20.B23"]}, ["0.0"]);
    G.selected_plane = "0.0";
    movePlanes.bomb("A20.B21");
    movePlanes.bomb("A20.B22");
    expect(G.selected_plane).toBeUndefined();
    G.selected_plane = "0.0";
    movePlanes.bomb("A20.B23");
    expect(plane.bombs_dropped).toBe(2);
  });

  it('does not use up the shot', () => {
    setup([he111()], {"0.0": ["A20.B21"]}, ["0.0"]);
    G.selected_plane = "0.0";
    movePlanes.bomb("A20.B21");
    expect(G.shot).toEqual([]);
  });

  it('is allowed only on strategic objects, which get marked (7.0.7)', () => {
    const plane = he111();
    setup([plane], {"0.0": ["A20.B21", "A25.B25"]}, ["0.0"]);
    G.selected_plane = "0.0";
    expect(bombActions()).toEqual([["bomb", "A20.B21"]]);
    movePlanes.bomb("A25.B25");
    expect(plane.bombs_dropped).toBeUndefined();
    expect(G.bombed).toEqual([]);
    movePlanes.bomb("A20.B21");
    expect(plane.bombs_dropped).toBe(1);
    expect(G.bombed).toEqual(["A20.B21"]);
  });

  it('a shot down plane loses its bombs (7.0.9)', () => {
    setup([he111({destroyed: true})], {"0.0": ["A20.B21"]}, ["0.0"]);
    expect(actionsOf(movePlanes.prompt)).toEqual([]);
    G.selected_plane = "0.0";
    movePlanes.bomb("A20.B21");
    expect(G.board.planes[R_Amer][0].bombs_dropped).toBeUndefined();
  });

  it('the selected plane can be deselected', () => {
    setup([he111()], {"0.0": ["A20.B21"]}, ["0.0"]);
    G.selected_plane = "0.0";
    movePlanes.deselect();
    expect(G.selected_plane).toBeUndefined();
  });
});

