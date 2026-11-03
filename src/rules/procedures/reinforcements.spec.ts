import {beforeEach, expect, it, vi} from "vitest";
import {G, planes, R_Jap, R_Amer} from "../globals";
import {endCombat} from "./phases";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

vi.stubGlobal("goto", vi.fn());
vi.stubGlobal("log", vi.fn());

beforeEach(() => {
  Object.assign(G, {
    active: R_Amer,
    stage: 3,
    board: {
      planes: {
        [R_Amer]: [{id: "0.0", plane: planes.SBD, at: "A20.B20", direction: 0}],
        [R_Jap]: [{id: "1.0", plane: planes.A6M6, at: "A01.B09", direction: 0}],
      }
    },
    reinforcements: {
      [R_Amer]: [],
      [R_Jap]: [
        {stage: 3, plane: planes.A6M6, at: "A01.B09", direction: 1},
        {stage: 5, plane: planes.A6M6, at: "A06.B30", direction: 3},
      ],
    },
  });
});

it('enters on its stage, in the movement phase of its side, next to an occupied hex', () => {
  endCombat();

  expect(G.active).toBe(R_Jap);
  expect(G.stage).toBe(3);
  const entered = G.board.planes[R_Jap];
  expect(entered).toHaveLength(2);
  expect(entered[1]).toMatchObject({id: "1.1", direction: 1});
  expect(entered[1].at).not.toBe("A01.B09");
});

it('the stage ends after the combat phase of the Japanese', () => {
  G.active = R_Jap;
  endCombat();

  expect(G.active).toBe(R_Amer);
  expect(G.stage).toBe(4);
  expect(G.board.planes[R_Jap]).toHaveLength(1);
});
