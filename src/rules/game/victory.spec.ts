import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {applyHit} from "./combat";
import {checkGameEnd, endingGame, winner} from "./victory";
import {exitsFor} from "./hex";
import {dropBomb} from "../procedures/bombers";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

const finish = vi.fn();

function plane(id: string, type: keyof typeof planes, overrides: Partial<PlaneInstance> = {}): PlaneInstance {
  return {id, plane: planes[type], at: "A20.B20", direction: 0, ...overrides}
}

beforeEach(() => {
  finish.mockClear();
  stubFramework({finish});
  for (const key of Object.keys(G)) delete (G as any)[key];
  Object.assign(G, {
    vp: {[R_Amer]: 0, [R_Jap]: 0},
    min_vp: {[R_Amer]: 35, [R_Jap]: 23},
    board: {planes: {[R_Amer]: [plane("0.0", "SBD")], [R_Jap]: [plane("1.0", "A6M6")]}},
    targets: ["A01.B01", "A02.B02"],
    flown_over: {},
    bombed: [],
    aa_guns: [],
  });
});

describe('table 1', () => {
  it.each([
    ["1.0", "A6M6", {[R_Amer]: 2, [R_Jap]: -1}],
    ["0.0", "SBD", {[R_Amer]: -2, [R_Jap]: 4}],
    ["0.0", "B25", {[R_Amer]: -2, [R_Jap]: 4}],
    ["0.0", "F4F", {[R_Amer]: -1, [R_Jap]: 2}],
  ] as const)('losing plane %s %s', (id, type, expected) => {
    applyHit(plane(id, type, {damaged: true}));
    expect(G.vp).toEqual(expected);
  });

  it('a damaged plane scores nothing', () => {
    applyHit(plane("1.0", "A6M6"));
    expect(G.vp).toEqual({[R_Amer]: 0, [R_Jap]: 0});
  });

  it('every series of bombs on a target counts, also on one bombed before (7.0.8)', () => {
    const bomber = plane("0.0", "B25");
    G.flown_over = {"0.0": ["A01.B01"]};
    dropBomb(bomber, "A01.B01");
    G.flown_over = {"0.0": ["A01.B01"]};
    dropBomb(bomber, "A01.B01");
    expect(G.vp![R_Amer]).toBe(6);
  });

  it('bombs elsewhere than on a target score nothing', () => {
    G.flown_over = {"0.0": ["A05.B05"]};
    dropBomb(plane("0.0", "B25"), "A05.B05");
    expect(G.vp![R_Amer]).toBe(0);
  });

  it('the score can go below zero (8.0)', () => {
    applyHit(plane("0.0", "SBD", {damaged: true}));
    expect(G.vp![R_Amer]).toBe(-2);
  });
});

describe('9.2: bonus for all the targets', () => {
  const bomb = (hex: string) => {
    G.flown_over = {"0.0": [hex]};
    dropBomb(plane("0.0", "B25"), hex);
  };

  beforeEach(() => {
    G.all_targets_vp = 5;
  });

  it('is not given for a part of them', () => {
    bomb("A01.B01");
    bomb("A01.B01");
    expect(G.vp![R_Amer]).toBe(6);
  });

  it('is given once, on top of the points for the series', () => {
    bomb("A01.B01");
    bomb("A02.B02");
    expect(G.vp![R_Amer]).toBe(3 + 3 + 5);
    bomb("A02.B02");
    expect(G.vp![R_Amer]).toBe(3 + 3 + 5 + 3);
  });
});

describe('8.1: end of the game', () => {
  it('goes on while both sides have planes', () => {
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
  });

  it('ends when the Germans have no planes left', () => {
    G.board.planes[R_Amer][0].destroyed = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalled();
  });

  it('goes on while the British have guns left', () => {
    G.board.planes[R_Jap][0].destroyed = true;
    G.aa_guns = ["A05.B05"];
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
  });

  it('goes on while reinforcements are to come', () => {
    G.board.planes[R_Jap][0].destroyed = true;
    G.reinforcements = {[R_Amer]: [], [R_Jap]: [{stage: 9, plane: planes.A6M6, at: "A01.B01", direction: 0}]};
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
  });

  it('ends when the British have neither planes nor guns', () => {
    G.board.planes[R_Jap][0].destroyed = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalled();
  });

  it('ends when both sides are gone at once, drawn at equal scores', () => {
    G.min_vp = {[R_Amer]: 10, [R_Jap]: 10};
    G.board.planes[R_Amer][0].destroyed = true;
    G.board.planes[R_Jap][0].destroyed = true;
    checkGameEnd();
    expect(finish.mock.calls[0][0]).toBe("Draw");
  });

  it('is checked after an action of a state, but not for its prompt', () => {
    G.board.planes[R_Amer][0].destroyed = true;
    const state = endingGame({inactive: "x", prompt: vi.fn(), done: vi.fn()});
    state.prompt();
    expect(finish).not.toHaveBeenCalled();
    state.done();
    expect(finish).toHaveBeenCalled();
    expect(state.inactive).toBe("x");
  });

  it('names the winner and the kind of the victory', () => {
    G.vp = {[R_Amer]: 35, [R_Jap]: 0};
    G.board.planes[R_Jap][0].destroyed = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalledWith(R_Amer, "Wygrywają Amerykanie (pełne zwycięstwo): Amerykanie 35/35 PZ, Japończycy 0/23 PZ");
  });
});

describe('8.2: the winner', () => {
  const min = {[R_Amer]: 35, [R_Jap]: 23};
  const scores = (niem: number, bryt: number) => ({[R_Amer]: niem, [R_Jap]: bryt});

  it('the one who reached the minimum', () => {
    expect(winner(scores(35, 10), min)).toBe(R_Amer);
    expect(winner(scores(10, 23), min)).toBe(R_Jap);
  });

  it('the one closer to the minimum (the example from the manual)', () => {
    expect(winner(scores(27, 19), min)).toBe(R_Jap);
  });

  it('at equal points missing, the larger percentage (the example from the manual)', () => {
    expect(winner(scores(31, 19), min)).toBe(R_Amer);
  });

  it('with both minimums reached, the larger surplus', () => {
    expect(winner(scores(40, 24), min)).toBe(R_Amer);
  });

  it('a draw when the requirements and the scores are the same', () => {
    expect(winner(scores(5, 5), {[R_Amer]: 10, [R_Jap]: 10})).toBeNull();
  });
});

describe('8.1: leaving through the south edge', () => {
  const S = 3, NE = 1, N = 0;
  const canLeaveSouth = (it: PlaneInstance, all = {[R_Amer]: [it]}) => exitsFor(it, all).some(exit => exit.south);
  const canLeave = (it: PlaneInstance) => canLeaveSouth(it);

  it('straight ahead, from the edge', () => {
    expect(canLeave(plane("0.0", "F4F", {at: "A20.B11", direction: S}))).toBe(true);
  });

  it('straight ahead, within the range', () => {
    expect(canLeave(plane("0.0", "F4F", {at: "A20.B16", direction: S}))).toBe(true);
  });

  it('not beyond the range', () => {
    expect(canLeave(plane("0.0", "F4F", {at: "A20.B17", direction: S}))).toBe(false);
  });

  it('not when flying away from the edge', () => {
    expect(canLeave(plane("0.0", "F4F", {at: "A20.B11", direction: N}))).toBe(false);
  });

  it('after a turn', () => {
    expect(canLeave(plane("0.0", "F4F", {at: "A20.B11", direction: NE}))).toBe(true);
  });

  it('not through a plane at the same altitude', () => {
    const bomber = plane("0.0", "SBD", {at: "A20.B13", direction: S});
    expect(canLeave(bomber)).toBe(true);
    expect(canLeaveSouth(bomber, {[R_Amer]: [bomber, plane("0.1", "F4F", {at: "A20.B12"})]})).toBe(false);
  });
});
