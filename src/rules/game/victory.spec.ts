import {beforeEach, describe, expect, it, vi} from "vitest";
import {stubFramework} from "@rzymek/rally-the-troops-module/testing";
import {G, planes, R_Jap, R_Amer} from "../globals";
import type {PlaneInstance} from "../types";
import {checkGameEnd, describeOutcome, endingGame} from "./victory";
import {exitsFor} from "./hex";
import {SCENARIOS} from "./scenarios";
import type {Tally} from "./outcomes";
import type {Ship} from "./ships";

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
    board: {planes: {[R_Amer]: [plane("0.0", "SBD")], [R_Jap]: [plane("1.0", "A6M6")]}},
    targets: ["A01.B01", "A02.B02"],
    bombed: [],
    aa_guns: [],
  });
});

function outcome(scenario: string, tally: Partial<Tally>) {
  return describeOutcome(SCENARIOS[scenario].victory({lost: {[R_Amer]: 0, [R_Jap]: 0}, bombed: 0, ships: [], ...tally}));
}

const lost = (amer: number, jap: number) => ({lost: {[R_Amer]: amer, [R_Jap]: jap}});

describe('8.0.1: the tables of the scenarios', () => {
  it.each([
    [4, 0, "Zdecydowane zwycięstwo Japończyków"],
    [3, 0, "Zdecydowane zwycięstwo Japończyków"],
    [3, 1, "Minimalne zwycięstwo Japończyków"],
    [2, 2, "Brak wyraźnego zwycięzcy"],
    [0, 2, "Minimalne zwycięstwo Amerykanów"],
    [1, 4, "Zdecydowane zwycięstwo Amerykanów"],
  ])('1: %i American, %i Japanese planes lost: %s', (amer, jap, expected) => {
    expect(outcome("1. Atak na Pearl Harbor", lost(amer, jap))).toBe(expected);
  });

  it.each([
    [8, 0, "Zdecydowane zwycięstwo Amerykanów"],
    [5, 0, "Minimalne zwycięstwo Amerykanów"],
    [5, 2, "Brak wyraźnego zwycięzcy"],
    [1, 2, "Minimalne zwycięstwo Japończyków"],
    [0, 4, "Zdecydowane zwycięstwo Japończyków"],
  ])('2: %i objects bombed, %i bombers lost: %s', (bombed, amer, expected) => {
    expect(outcome("2. Kampania powietrzna na Filipinach", {bombed, ...lost(amer, 0)})).toBe(expected);
  });

  const ship = (overrides: Partial<Ship> = {}): Ship =>
    ({id: "0.s0", side: R_Amer, type: "PANCERNIK", nazwa: "Prince of Wales", hexes: [], ...overrides});

  it.each([
    [{sunk: true, damage: 26}, 3, "Zdecydowane zwycięstwo Japończyków"],
    [{sunk: true, damage: 26}, 6, "Minimalne zwycięstwo Japończyków"],
    [{sunk: true, damage: 26}, 7, "Brak wyraźnego zwycięzcy"],
    [{damage: 13}, 4, "Brak wyraźnego zwycięzcy"],
    [{damage: 13}, 5, "Minimalne zwycięstwo Amerykanów"],
    [{damage: 13}, 9, "Zdecydowane zwycięstwo Amerykanów"],
    [{damage: 12}, 0, "Zdecydowane zwycięstwo Amerykanów"],
  ])('3: the battleship %o, %i Japanese planes lost', (state, jap, expected) => {
    expect(outcome("3. Bitwa pod Kuantan", {ships: [ship(state)], ...lost(0, jap)})).toBe(expected);
  });

  it('6: 2 for an object, 10 for a transport sunk, less 2 for a plane lost', () => {
    const transport = (sunk: boolean): Ship => ({id: "0.s1", side: R_Amer, type: "TRANSPORTOWIEC", nazwa: "Statek", hexes: [], sunk});
    expect(outcome("6. Operacja I", {bombed: 2, ships: [transport(true)], ...lost(0, 0)})).toBe("Zdecydowane zwycięstwo Japończyków");
    expect(outcome("6. Operacja I", {bombed: 3, ships: [transport(false)], ...lost(0, 0)})).toBe("Minimalne zwycięstwo Japończyków");
    expect(outcome("6. Operacja I", {bombed: 0, ...lost(0, 2)})).toBe("Minimalne zwycięstwo Amerykanów");
    expect(outcome("6. Operacja I", {bombed: 0, ...lost(0, 7)})).toBe("Zdecydowane zwycięstwo Amerykanów");
  });
});

describe('8.0.2: end of the game', () => {
  it('goes on while both sides have planes', () => {
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
  });

  it('ends when the Americans have no units left', () => {
    G.board.planes[R_Amer][0].destroyed = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalled();
  });

  it('goes on while the Japanese have guns left', () => {
    G.board.planes[R_Jap][0].destroyed = true;
    G.aa_guns = [{hex: "A05.B05", side: R_Jap, heavy: true}];
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
  });

  it('goes on while reinforcements are to come', () => {
    G.board.planes[R_Jap][0].destroyed = true;
    G.reinforcements = {[R_Amer]: [], [R_Jap]: [{stage: 9, plane: planes.A6M6, at: "A01.B01", direction: 0}]};
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
  });

  it('ends when the Japanese have neither planes nor guns', () => {
    G.board.planes[R_Jap][0].destroyed = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalled();
  });

  it('goes on while a ship is afloat', () => {
    G.board.planes[R_Amer][0].destroyed = true;
    G.ships = [{id: "0.s0", side: R_Amer, type: "NISZCZYCIEL", nazwa: "Niszczyciel", hexes: ["A30.B30", "A31.B30"]}];
    checkGameEnd();
    expect(finish).not.toHaveBeenCalled();
    G.ships[0].sunk = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalled();
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

  it('names the outcome by the table of the scenario, with what it counted', () => {
    G.scenario = "1. Atak na Pearl Harbor";
    G.targets = [];
    G.board.planes[R_Amer] = [plane("0.0", "F4F", {destroyed: true}), plane("0.1", "F4F", {destroyed: true}), plane("0.2", "F4F", {destroyed: true, left_board: true})];
    checkGameEnd();
    expect(finish).toHaveBeenCalledWith(R_Jap, "Minimalne zwycięstwo Japończyków: straty: Amerykanie 2, Japończycy 0");
  });

  it('no clear winner is a draw', () => {
    G.scenario = "1. Atak na Pearl Harbor";
    G.targets = [];
    G.board.planes[R_Amer][0].destroyed = true;
    G.board.planes[R_Jap][0].destroyed = true;
    checkGameEnd();
    expect(finish).toHaveBeenCalledWith("Draw", "Brak wyraźnego zwycięzcy: straty: Amerykanie 1, Japończycy 1");
  });
});
describe('4.3: leaving through the south edge', () => {
  const S = 3, NE = 1, N = 0;
  const canLeaveSouth = (it: PlaneInstance, all = {[R_Amer]: [it]}) => exitsFor(it, all).some(exit => exit.edge === "S");
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
