import {beforeEach, describe, expect, it, vi} from "vitest";
import {G, planes, R_Jap, R_Amer} from "../globals";
import {on_setup} from "../lifecycle/on_setup";
import {hexesAround} from "../game/scenarios";
import {placePlanes} from "./place_planes";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
  L: {},
}));

const goto = vi.fn();
const call = vi.fn();

function actions() {
  const action = vi.fn();
  vi.stubGlobal("prompt", vi.fn());
  vi.stubGlobal("button", vi.fn());
  vi.stubGlobal("action", action);
  placePlanes.prompt();
  return action.mock.calls.filter(([name]) => name === "place_plane").map(([, hex]) => hex);
}

beforeEach(() => {
  for (const key of Object.keys(G)) delete (G as any)[key];
  goto.mockClear();
  vi.stubGlobal("goto", goto);
  vi.stubGlobal("call", call);
  vi.stubGlobal("log", vi.fn());
  vi.stubGlobal("push_undo", vi.fn());
  vi.stubGlobal("clear_undo", vi.fn());
  vi.stubGlobal("random", () => 0);
  on_setup("1. Atak na Pearl Harbor", undefined);
});

describe('9.3: setting up the planes', () => {
  it('starts with empty skies, the Japanese first', () => {
    expect(G.active).toBe(R_Jap);
    expect(call).toHaveBeenCalledWith("place_planes");
    expect(G.board.planes[R_Jap]).toEqual([]);
    expect(G.to_place![R_Jap]).toHaveLength(6);
  });

  it('offers the free starting hexes only', () => {
    expect(actions().sort()).toEqual(hexesAround('A49.B39', 2).sort());
    placePlanes.place_plane('A49.B39');
    expect(actions()).not.toContain('A49.B39');
  });

  it('rejects hexes outside of the radius', () => {
    placePlanes.place_plane('A20.B20');
    expect(G.board.planes[R_Jap]).toEqual([]);
  });

  it('lets the player turn the placed plane', () => {
    placePlanes.place_plane('A49.B39');
    const placed = G.board.planes[R_Jap][0];
    expect(placed.plane).toBe(planes.A6M);
    const direction = placed.direction;
    placePlanes.turn_right();
    expect(placed.direction).toBe((direction + 1) % 6);
  });

  it('hands over to the Americans, then starts the game', () => {
    placePlanes.done();
    expect(G.active).toBe(R_Jap);

    const placeAll = () => {
      const hexes = hexesAround(G.to_place![G.active][0].center, G.to_place![G.active][0].radius);
      let i = 0;
      while (G.to_place![G.active].length) placePlanes.place_plane(hexes[i++]);
    };
    placeAll();
    placePlanes.done();
    expect(G.active).toBe(R_Amer);
    expect(goto).not.toHaveBeenCalled();

    placeAll();
    placePlanes.next_type();
    placePlanes.done();
    expect(goto).toHaveBeenCalledWith("move_planes");
    expect(G.board.planes[R_Amer]).toHaveLength(4);
    expect(new Set(G.board.planes[R_Amer].map(it => it.id)).size).toBe(4);
  });

  it('next_type moves on to another type', () => {
    on_setup("2. Kampania powietrzna na Filipinach", undefined);
    G.active = R_Amer;
    expect(G.to_place![R_Amer][0].plane.nazwa).toBe(planes.B17.nazwa);
    placePlanes.next_type();
    expect(G.to_place![R_Amer][0].plane.nazwa).toBe(planes.B25.nazwa);
  });
});
