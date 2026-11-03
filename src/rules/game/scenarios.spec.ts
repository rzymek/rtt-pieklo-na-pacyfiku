import {describe, expect, it} from "vitest";
import svg from "../../play/map.svg?raw";
import {hexesAround, SCENARIOS} from "./scenarios";
import {data} from "./data";

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

it('hexesAround stays on the board, nearest first', () => {
  expect(hexesAround('A10.B08', 1)).toHaveLength(7);
  expect(hexesAround('A10.B08', 1)[0]).toBe('A10.B08');
  expect(hexesAround('A01.B01', 1).sort()).toEqual(['A01.B01', 'A01.B02', 'A02.B02']);
});

it.each(Object.entries(SCENARIOS))('%s uses no more counters of a type than the box has (table 2)', (_name, scenario) => {
  const used = new Map<string, number>();
  for (const side of [scenario.japonczycy, scenario.amerykanie]) {
    const planes = [...side.deployments.flatMap(it => it.planes), ...(side.reinforcements ?? []).map(it => it.plane)];
    for (const plane of planes) used.set(plane.img, (used.get(plane.img) ?? 0) + 1);
  }
  const counters = new Map(Object.values(data.planes).map(it => [it.img, it.zetony]));
  for (const [img, count] of used) expect(count).toBeLessThanOrEqual(counters.get(img)!);
});
