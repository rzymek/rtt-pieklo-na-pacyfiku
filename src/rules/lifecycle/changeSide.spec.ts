import {describe, expect, it, vi} from "vitest";
import {G, R_Jap, R_Amer} from "../globals";
import {changeSide, otherSide} from "./changeSide";

vi.mock("../globals", async importOriginal => ({
  ...await importOriginal<typeof import("../globals")>(),
  G: {},
}));

describe('otherSide', () => {
  it('returns the opposite side', () => {
    expect(otherSide(R_Amer)).toBe(R_Jap);
    expect(otherSide(R_Jap)).toBe(R_Amer);
  });
});

describe('changeSide', () => {
  it('toggles G.active', () => {
    G.active = R_Amer;
    changeSide();
    expect(G.active).toBe(R_Jap);
    changeSide();
    expect(G.active).toBe(R_Amer);
  });
});
