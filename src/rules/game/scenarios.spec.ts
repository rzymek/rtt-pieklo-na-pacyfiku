import {describe, expect, it} from "vitest";
import svg from "../../play/map.svg?raw";
import {hexesAround, SCENARIOS} from "./scenarios";

const MAP_HEXES = new Set([...svg.matchAll(/id="(A\d+\.B\d+)"/g)].map(m => m[1]));

describe.each(Object.entries(SCENARIOS))('%s', (_name, scenario) => {
  const sides = [scenario.japonczycy, scenario.amerykanie];
  const starting = sides.flatMap(side => side.deployments.flatMap(({center, radius, planes}) =>
    hexesAround(center, radius).slice(0, planes.length)));

  it('has room for every plane in its starting hexes (4.1.1, 9.3)', () => {
    for (const {deployments} of sides) {
      for (const {center, radius, planes} of deployments) {
        expect(hexesAround(center, radius).length).toBeGreaterThanOrEqual(planes.length);
      }
    }
    expect(new Set(starting).size).toBe(starting.length);
  });

  it('refers to hexes of the map only', () => {
    const reinforcements = sides.flatMap(side => (side.reinforcements ?? []).map(it => it.at));
    for (const hex of [...starting, ...reinforcements, ...scenario.targets]) {
      expect(MAP_HEXES).toContain(hex);
    }
  });
});

it('Wariant 5 targets all 12 strategic points, including those of the other scenarios', () => {
  const all = SCENARIOS["Wariant 5"].targets;
  expect(new Set(all).size).toBe(12);
  for (const {targets} of Object.values(SCENARIOS)) {
    expect(all).toEqual(expect.arrayContaining(targets));
  }
});

it('hexesAround stays on the board, nearest first', () => {
  expect(hexesAround('A10.B08', 1)).toHaveLength(7);
  expect(hexesAround('A10.B08', 1)[0]).toBe('A10.B08');
  expect(hexesAround('A00.B00', 1).sort()).toEqual(['A00.B00', 'A00.B01', 'A01.B00', 'A01.B01']);
});
