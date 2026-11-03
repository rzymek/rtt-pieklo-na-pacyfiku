// it.each covers both branches of the outcome check.
/* oxlint-disable vitest/no-conditional-expect */
import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, planes, R_Jap, R_Amer, V} from "../globals";
import {on_view} from "../lifecycle/on_view";
import type {PlaneInstance} from "../types";
import {exitsFor, flightsFor, isEdgeHex} from "../game/hex";
import {fireTarget} from "./shooters";
import {isForced, movePlanes} from "./move_planes";
import {nextToReturn, returnHexes, returnPlanes} from "./return_planes";
import {endCombat} from "./phases";
import {combat} from "./combat";
import {isGameOver} from "../game/victory";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
  L: {},
  V: {unmoved: []},
}));

const N = 0, S = 3;
const goto = vi.fn();
let dice: number[];
const roll = (value: number) => dice = [value - 1];

function plane(id: string, type: keyof typeof planes, overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id, plane: planes[type], at: "A20.B20", direction: N, ...overrides}
}

function setup(niem: PlaneInstance[], bryt: PlaneInstance[], active = R_Amer) {
  for (const key of Object.keys(G)) delete (G as any)[key];
  Object.assign(G, {
    active, stage: 3, moved: [], shot: [], flown_over: {}, aa_guns: [], aa_fired: [], off_board: [], targets: [], bombed: [],
    vp: {[R_Amer]: 0, [R_Jap]: 0}, min_vp: {[R_Amer]: 10, [R_Jap]: 10},
    reinforcements: {[R_Amer]: [], [R_Jap]: []},
    board: {planes: {[R_Amer]: niem, [R_Jap]: bryt}},
  });
}

function buttons(state: { prompt(): void }) {
  const button = vi.fn();
  vi.stubGlobal("prompt", vi.fn());
  vi.stubGlobal("button", button);
  vi.stubGlobal("action", vi.fn());
  state.prompt();
  return button.mock.calls.filter(([, enabled]) => enabled !== false).map(([name]) => name);
}

beforeEach(() => {
  goto.mockClear();
  stubFramework({goto, random: () => dice.shift()});
});

const EAST_EDGE = "A56.B40";
const EAST = 2; // DIR_OFFSETS: a+1

function leave(from: PlaneInstance, hex: string) {
  G.selected_plane = from.id;
  movePlanes.leave_board();
  movePlanes.leave_hex(hex);
}

describe('board limits', () => {
  it('offers no flights off the board', () => {
    const it = plane("0.0", "F4F", {at: EAST_EDGE, direction: EAST});
    const flights = flightsFor(it, {[R_Amer]: [it]});
    expect(Object.keys(flights).every(hex => parseInt(hex.slice(1)) <= 56)).toBe(true);
    expect(exitsFor(it, {[R_Amer]: [it]})).toContainEqual({hex: EAST_EDGE, south: false});
  });

  it('knows the edge hexes', () => {
    expect(isEdgeHex(EAST_EDGE)).toBe(true);
    expect(isEdgeHex("A20.B20")).toBe(false);
  });
});

describe('4.3: leaving the board', () => {
  it('British: no die, comes back in 5 stages', () => {
    const it = plane("1.0", "A6M6", {at: EAST_EDGE, direction: EAST});
    setup([], [it], R_Jap);
    leave(it, EAST_EDGE);
    expect(G.board.planes[R_Jap]).toEqual([]);
    expect(G.off_board).toEqual([{plane: it, return_stage: 8, from: EAST_EDGE}]);
  });

  describe('German, not through the south edge (4.3.2)', () => {
    it.each([
      [1, false, "destroyed"],
      [2, false, "damaged"],
      [2, true, "destroyed"],
      [3, false, "intact"],
      [6, true, "damaged"],
    ])('roll %i, damaged before: %s → %s', (value, damaged, outcome) => {
      const it = plane("0.0", "F4F", {at: EAST_EDGE, direction: EAST, damaged});
      setup([it], []);
      roll(value);
      leave(it, EAST_EDGE);
      if (outcome === "destroyed") {
        expect(it.destroyed).toBe(true);
        expect(G.vp).toEqual({[R_Amer]: -1, [R_Jap]: 2});
        expect(G.off_board).toEqual([]);
      } else {
        expect(it.destroyed).toBeUndefined();
        expect(!!it.damaged).toBe(outcome === "damaged");
        expect(G.off_board![0].return_stage).toBe(8);
        expect(G.vp).toEqual({[R_Amer]: 0, [R_Jap]: 0});
      }
    });
  });

  describe('German, through the south edge (8.1)', () => {
    const south = () => {
      const it = plane("0.0", "SBD", {at: "A20.B11", direction: S});
      setup([it, plane("0.1", "SBD", {at: "A30.B30"})], [plane("1.0", "A6M6", {at: "A10.B20"})]);
      dice = [];
      leave(it, "A20.B11");
      return it;
    };

    it('rolls no die and asks about the return', () => {
      south();
      expect(buttons(movePlanes)).toEqual(["leave_return", "leave_forever"]);
    });

    it('may skip the exit hex when not coming back', () => {
      const it = plane("0.0", "SBD", {at: "A20.B11", direction: S});
      setup([it, plane("0.1", "SBD", {at: "A30.B30"})], [plane("1.0", "A6M6", {at: "A10.B20"})]);
      G.selected_plane = it.id;
      movePlanes.leave_board();
      expect(buttons(movePlanes)).toEqual(["leave_forever"]);
      movePlanes.leave_forever();
      expect(it).toMatchObject({destroyed: true, left_board: true});
      expect(G.vp).toEqual({[R_Amer]: 0, [R_Jap]: 0});
    });

    it('may come back', () => {
      const it = south();
      movePlanes.leave_return();
      expect(G.off_board).toEqual([{plane: it, return_stage: 8, from: "A20.B11"}]);
      expect(it.left_board).toBeUndefined();
    });

    it('or leave for good, with no points for the enemy', () => {
      const it = south();
      movePlanes.leave_forever();
      expect(it).toMatchObject({destroyed: true, left_board: true});
      expect(G.off_board).toEqual([]);
      expect(G.vp).toEqual({[R_Amer]: 0, [R_Jap]: 0});
    });
  });

  it('no leave_board button while choosing the exit hex', () => {
    const it = plane("1.0", "A6M6", {at: EAST_EDGE, direction: EAST});
    setup([], [it], R_Jap);
    G.selected_plane = it.id;
    movePlanes.leave_board();
    expect(buttons(movePlanes)).toEqual([]);
  });

  it('a plane waiting to return is out of reach, yet still counts as a unit', () => {
    const it = plane("1.0", "A6M6", {at: EAST_EDGE, direction: EAST});
    setup([plane("0.0", "SBD", {at: "A55.B40", direction: EAST})], [it], R_Jap);
    leave(it, EAST_EDGE);
    expect(fireTarget(G.board.planes[R_Amer][0], R_Amer)).toBeNull();
    G.board.planes[R_Jap] = [];
    expect(isGameOver()).toBe(false);
  });

  it('comes back after 5 stages, on a free edge hex within 5 hexes, then moves as usual (4.3.1)', () => {
    const it = plane("0.0", "SBD", {at: EAST_EDGE});
    setup([plane("0.1", "SBD", {at: "A56.B41"})], [plane("1.0", "A6M6", {at: "A10.B20"})], R_Jap);
    G.off_board = [{plane: it, return_stage: 4, from: EAST_EDGE}];
    endCombat();
    expect(G.stage).toBe(4);
    expect(goto).toHaveBeenCalledWith("return_planes");

    const hexes = returnHexes(G.off_board[0]);
    expect(hexes).toContain("A56.B45");
    expect(hexes).not.toContain("A56.B46");
    expect(hexes).not.toContain("A55.B40");
    expect(hexes).not.toContain("A56.B41");

    returnPlanes.return_hex("A55.B42");
    expect(it.at).toBe(EAST_EDGE);
    returnPlanes.return_hex("A56.B45");
    expect(it.at).toBe("A56.B45");
    expect(G.board.planes[R_Amer]).toContain(it);
    expect(nextToReturn()).toBeUndefined();

    returnPlanes.turn_left();
    expect(it.direction).toBe(5);
    goto.mockClear();
    returnPlanes.done();
    expect(goto).toHaveBeenCalledWith("move_planes");
  });

  it('shows the players the free hexes a plane may come back to', () => {
    const it = plane("0.0", "SBD", {at: EAST_EDGE});
    setup([plane("0.1", "SBD", {at: "A56.B41"})], []);
    G.off_board = [{plane: it, return_stage: 8, from: EAST_EDGE}];
    on_view();
    const [waiting] = V.off_board!;
    expect(waiting).toMatchObject({side: R_Amer, return_stage: 8});
    expect(waiting.hexes).toEqual(returnHexes(G.off_board[0]));
    expect(waiting.hexes).toContain("A56.B45");
    expect(waiting.hexes).not.toContain("A56.B41");
  });

  it('does not come back too early, and reinforcements get an unused id', () => {
    const it = plane("1.0", "A6M6");
    setup([plane("0.0", "SBD")], [], R_Amer);
    G.off_board = [{plane: it, return_stage: 8, from: EAST_EDGE}];
    G.reinforcements![R_Jap] = [{stage: 3, plane: planes.A6M6, at: "A01.B09", direction: 1}];
    endCombat();
    expect(goto).toHaveBeenCalledWith("move_planes");
    expect(G.board.planes[R_Jap][0].id).toBe("1.1");
  });
});

describe('no own plane on the board', () => {
  const offBoard = (id: string, return_stage: number) =>
    ({plane: plane(id, id.startsWith("0") ? "SBD" : "A6M6"), return_stage, from: EAST_EDGE});

  it('skips the movement phase of that side', () => {
    setup([plane("0.0", "SBD")], []);
    G.off_board = [offBoard("1.0", 8)];
    endCombat();
    expect(G.active).toBe(R_Amer);
    expect(G.stage).toBe(4);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith("move_planes");
  });

  it('destroyed planes do not count', () => {
    setup([plane("0.0", "SBD")], [plane("1.0", "A6M6", {destroyed: true})]);
    G.off_board = [offBoard("1.1", 8)];
    endCombat();
    expect(G.active).toBe(R_Amer);
  });

  it('keeps the movement phase when a plane returns or a reinforcement enters', () => {
    setup([plane("0.0", "SBD")], []);
    G.off_board = [offBoard("1.0", 3)];
    endCombat();
    expect(G.active).toBe(R_Jap);
    expect(goto).toHaveBeenCalledWith("return_planes");

    goto.mockClear();
    setup([plane("0.0", "SBD")], []);
    G.off_board = [offBoard("1.0", 8)];
    G.reinforcements![R_Jap] = [{stage: 3, plane: planes.A6M6, at: "A01.B09", direction: 1}];
    endCombat();
    expect(G.active).toBe(R_Jap);
    expect(goto).toHaveBeenCalledWith("move_planes");
  });

  it('keeps the AA phase for its guns (6.2)', () => {
    const he = plane("0.0", "SBD", {at: "A20.B20", altitude: 1});
    setup([he], []);
    G.off_board = [offBoard("1.0", 8)];
    G.aa_guns = ["A20.B20"];
    movePlanes.done();
    expect(G.active).toBe(R_Jap);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith("anti_aircraft");
  });

  it('moves the stages on while both sides are off the board', () => {
    setup([], []);
    G.off_board = [offBoard("0.0", 6), offBoard("1.0", 8)];
    endCombat();
    expect(G.active).toBe(R_Amer);
    expect(G.stage).toBe(6);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith("return_planes");
  });
});

describe('4.2.6: no free way to fly', () => {
  // A He-111 at max speed 4, min 3, turns after 2. Boxed in on all altitudes it can reach.
  function boxed(extra: Partial<PlaneInstance> = {}) {
    const he = plane("0.0", "SBD", {at: "A20.B20", direction: N, damaged: true, ...extra});
    const blocker = (id: string, at: string, altitude: number) => plane(id, "A6M6", {at, altitude});
    // Damaged: 3-3, cannot climb; it can go down by two levels.
    const blockers = ["A20.B21"].flatMap((at, i) => [5, 4, 3].map(altitude => blocker(`1.${i}${altitude}`, at, altitude)));
    setup([he], blockers);
    return he;
  }

  it('is not forced with a free altitude', () => {
    const he = plane("0.0", "SBD", {at: "A20.B20"});
    setup([he], [plane("1.0", "A6M6", {at: "A20.B21"})]);
    expect(isForced(he)).toBe(false);
  });

  it('never blocks: a boxed-in plane can still fly, and a landing there is checked', () => {
    const he = boxed();
    expect(isForced(he)).toBe(true);
    G.selected_plane = he.id;
    const on = plane("1.5", "A6M6", {at: "A20.B23"});
    G.board.planes[R_Jap].push(on);
    roll(3);
    movePlanes.move_hex("A20.B23");
    expect(he.at).toBe("A20.B23");
    expect(he.destroyed).toBeUndefined();
    expect(on.destroyed).toBeUndefined();
  });

  it('a 6 destroys both, costing only the owners their planes', () => {
    const he = boxed();
    G.selected_plane = he.id;
    const on = plane("1.5", "A6M6", {at: "A20.B23"});
    G.board.planes[R_Jap].push(on);
    roll(6);
    movePlanes.move_hex("A20.B23");
    expect(he.destroyed).toBe(true);
    expect(on.destroyed).toBe(true);
    expect(G.vp).toEqual({[R_Amer]: -2, [R_Jap]: -1});
  });
});

describe('5.3.4: unjamming', () => {
  it('the guns work from the next stage on', () => {
    const it = plane("0.0", "F4F", {jammed: true});
    setup([it], [plane("1.0", "A6M6", {at: "A20.B21"})]);
    G.selected_plane = it.id;
    dice = [5];
    combat.unjam();
    expect(it.jammed).toBeUndefined();
    G.shot = [];
    expect(fireTarget(it, R_Amer)).toBeNull();
    G.stage++;
    expect(fireTarget(it, R_Amer)).not.toBeNull();
  });
});

describe('ending the combat phase', () => {
  beforeEach(() => vi.stubGlobal("push_undo", vi.fn()));

  it('asks for confirmation while a plane may still fire', () => {
    setup([plane("0.0", "F4F")], [plane("1.0", "A6M6", {at: "A20.B21"})]);
    combat.done();
    expect(G.confirm_done).toBe(true);
    expect(G.stage).toBe(3);
    expect(buttons(combat)).toEqual(["confirm_done", "cancel"]);
    combat.cancel();
    expect(buttons(combat)).toContain("done");
    combat.done();
    combat.confirm_done();
    expect(G.confirm_done).toBeUndefined();
    expect(G.active).toBe(R_Jap);
  });

  it('ends at once once every plane has fired', () => {
    setup([plane("0.0", "F4F")], [plane("1.0", "A6M6", {at: "A20.B21"})]);
    G.shot = ["0.0"];
    combat.done();
    expect(G.confirm_done).toBeUndefined();
    expect(G.active).toBe(R_Jap);
  });
});

describe('undo after the movement phase', () => {
  it('ending the moves can be taken back until a die is rolled in combat', () => {
    const pushUndo = vi.fn(), clearUndo = vi.fn();
    vi.stubGlobal("push_undo", pushUndo);
    vi.stubGlobal("clear_undo", clearUndo);
    const me = plane("0.0", "F4F");
    setup([me], [plane("1.0", "A6M6", {at: "A20.B21"})]);
    G.moved = [me.id];
    movePlanes.done();
    expect(pushUndo).toHaveBeenCalledTimes(1);
    expect(G.active).toBe(R_Amer);
    expect(goto).toHaveBeenCalledWith("combat");
    expect(clearUndo).not.toHaveBeenCalled();

    G.selected_plane = me.id;
    dice = [0];
    combat.attack();
    expect(clearUndo).toHaveBeenCalled();
  });
});
