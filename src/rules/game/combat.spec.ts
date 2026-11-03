import {describe, expect, it, vi} from "vitest";
import {CLOUD_HEXES} from "./terrain";
import {planes} from "../globals";
import type {PlaneInstance} from "../types";
import type {PlaneData} from "./data";
import {describeShot, hitChance, rollShot} from "./combat";

// Table 2, the lowest roll that hits, up to 11: [attack strength, [by distance 1-5]]
const TABLE_2: [number, (number | null)[]][] = [
  [0, [null, null, null, null, null]],
  [1, [9, 10, 11, null, null]],
  [2, [8, 9, 10, 11, null]],
  [3, [7, 8, 9, 10, 11]],
  [4, [6, 7, 8, 9, 10]],
  [5, [5, 6, 7, 8, 9]],
];

function shoot(sila_ataku: number, distance: number, sum: number) {
  const dice = [Math.ceil(sum / 2) - 1, Math.floor(sum / 2) - 1];
  vi.stubGlobal("random", () => dice.shift());
  const attacker = {id: "1.0", plane: {...planes.A6M6, sila_ataku} as PlaneData, at: "A20.B20", direction: 0};
  const target = {id: "0.0", plane: planes.SBD, at: "A20.B21", direction: 0};
  return rollShot(attacker, target, distance).hit;
}

const cases = TABLE_2.flatMap(([atk, row]) => row.map((from, i) => [atk, i + 1, from] as const));

it.each(cases)('attack strength %i, distance %i: hits from %s to 11', (atk, distance, from) => {
  for (let sum = 3; sum <= 11; sum++) {
    expect(shoot(atk, distance, sum), `roll ${sum}`).toBe(from !== null && sum >= from);
  }
});

it.each([2, 12])('a roll of %i never hits (5.3.4)', sum => {
  expect(shoot(5, 1, sum)).toBe(false);
});

const WAYS_TO_ROLL: Record<number, number> = {2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1};

it.each(cases)('attack strength %i, distance %i: the chance agrees with the rolls that hit from %s', (atk, distance) => {
  let ways = 0;
  for (let sum = 2; sum <= 12; sum++) {
    if (shoot(atk, distance, sum)) ways += WAYS_TO_ROLL[sum];
  }
  expect(hitChance(atk, distance)).toBeCloseTo(ways / 36);
});

describe("describeShot", () => {
  const plane = (overrides: Partial<PlaneInstance> = {}): PlaneInstance =>
    ({id: "1.0", plane: {...planes.A6M6, sila_ataku: 4} as PlaneData, at: "A20.B20", direction: 0, ...overrides});

  it('shows the strength, the distance, the rolls and the chances', () => {
    expect(describeShot(plane(), plane(), 2))
      .toBe("SA 4, odległość 2: rzut 7–11 – trafienie 56%, zacięcie 6%");
  });

  it('shows the strength of a damaged plane', () => {
    const damaged = plane({damaged: true});
    expect(describeShot(damaged, plane(), 1))
      .toContain(`SA ${damaged.plane.reduced.sila_ataku} (uszkodzony)`);
  });

  it('shows the modifiers of clouds', () => {
    const inCloud = plane({at: CLOUD_HEXES[0]});
    const description = describeShot(inCloud, inCloud, 1);
    expect(description).toContain("SA 4, chmura atakującego −2, chmura celu −2 = SA 0");
    expect(description).toContain("bez szans – trafienie 0%");
  });
});
