// Builds the map from the scan of the board (resources/mapa.png):
//   public/images/mapa.jpg        - the background, scaled down
//   src/play/map.svg              - the background with one <use id="A<nn>.B<nn>"> per hex
//   src/rules/game/terrain.ts     - the cloud and land hexes, read off the colours of the scan
// Run: node tools/generate-map.ts   (needs ImageMagick's `convert`)
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCAN = resolve(ROOT, 'resources/mapa.png');
const BACKGROUND = resolve(ROOT, 'public/images/mapa.jpg');
const MAP_SVG = resolve(ROOT, 'src/play/map.svg');
const TERRAIN = resolve(ROOT, 'src/rules/game/terrain.ts');

// Scan pixels, measured on the coordinate labels at the edges of the board.
const WIDTH = 5770, HEIGHT = 4277;
const A1_B1 = {x: 481, y: 4043};
// Between columns (A); between hexes of a column (B).
const DX = (5541 - 481) / 55;
const DY = (3990 - 172) / 36;
// SVG units per scan pixel: the same hex size as in Lew Morski, which the counters are drawn for.
const SCALE = 24.068 / DX;
// The background is twice the SVG size: enough for zooming in.
const BACKGROUND_WIDTH = 2885;

const hexId = (a: number, b: number) => `A${String(a).padStart(2, '0')}.B${String(b).padStart(2, '0')}`;

function center(a: number, b: number) {
  return {x: A1_B1.x + (a - 1) * DX, y: A1_B1.y - (b - 1) * DY + (a - 1) * DY / 2};
}

const rgb = execFileSync('convert', [SCAN, '-depth', '8', 'rgb:-'], {maxBuffer: WIDTH * HEIGHT * 3 + 1024});
if (rgb.length !== WIDTH * HEIGHT * 3) throw new Error(`${SCAN}: expected ${WIDTH}x${HEIGHT}`);

type Kind = 'water' | 'cloud' | 'land' | 'border' | 'line'

function kindAt(x: number, y: number): Kind {
  const i = (Math.round(y) * WIDTH + Math.round(x)) * 3;
  const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]];
  if (r < 60 && g < 60 && b < 60) return 'line';
  if (Math.abs(r - 93) < 12 && Math.abs(g - 144) < 12 && Math.abs(b - 227) < 12) return 'water';
  if (Math.abs(r - 196) < 4 && Math.abs(g - 196) < 4 && Math.abs(b - 196) < 4) return 'cloud';
  // The red frame and the white hexes with the coordinates.
  if (r > 200 && g < 40 && b < 40) return 'border';
  if (r > 240 && g > 240 && b > 240) return 'border';
  return 'land';
}

// Points inside the hex, kept off its outline.
function samples(a: number, b: number): Kind[] {
  const {x, y} = center(a, b);
  const kinds: Kind[] = [];
  // A flat-topped hex: corners at ±R on the horizontal axis, flat sides at ±H, shrunk a little.
  const R = DX / 1.5 * 0.85, H = DY / 2 * 0.85;
  const step = DX / 15;
  for (let dx = -R; dx <= R; dx += step) {
    for (let dy = -H; dy <= H; dy += step) {
      const inside = Math.abs(dx) * H + Math.abs(dy) * R / 2 <= R * H
      if (inside && x + dx >= 0 && x + dx < WIDTH && y + dy >= 0 && y + dy < HEIGHT) kinds.push(kindAt(x + dx, y + dy));
    }
  }
  return kinds.filter(it => it !== 'line');
}

const scanned: string[] = [], clouds: string[] = [], cloudEdges: string[] = [], land: string[] = [];
const positions: Record<string, {x: number, y: number}> = {};
for (let a = 0; a <= 58; a++) {
  for (let b = 0; b <= 70; b++) {
    const {x, y} = center(a, b);
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
    const kinds = samples(a, b);
    const share = (kind: Kind) => kinds.filter(it => it === kind).length / kinds.length;
    if (kinds.length === 0 || share('border') > 0.5) continue;
    const id = hexId(a, b);
    scanned.push(id);
    positions[id] = {x, y};
    // No cloud over the island: its light grey tanks are the colour of the clouds.
    const cloud = share('land') > 0.2 ? 0 : share('cloud');
    if (cloud >= 0.95) clouds.push(id);
    else if (cloud > 0.02) cloudEdges.push(id);
    if (share('land') >= 0.5) land.push(id);
  }
}

// The board shape assumed by isOnBoard() in hex.ts.
export function isOnBoard(a: number, b: number) {
  const bottom = Math.floor(a / 2) + 1
  const top = Math.floor((a + 1) / 2) + 37
  return a >= 1 && a <= 56 && b >= bottom && b <= top
}

const expected: string[] = [];
for (let a = 0; a <= 58; a++) for (let b = 0; b <= 70; b++) if (isOnBoard(a, b)) expected.push(hexId(a, b));
// The compass rose is white and red like the frame: its hexes are on the board all the same.
const COMPASS = ['A48.B31', 'A49.B31', 'A50.B32', 'A50.B33', 'A51.B32'];
const missing = expected.filter(it => !scanned.includes(it) && !COMPASS.includes(it));
const extra = scanned.filter(it => !expected.includes(it));
if (missing.length || extra.length) throw new Error(`board shape: missing ${missing}, extra ${extra}`);
const board = expected;
for (const id of COMPASS) {
  const [a, b] = id.slice(1).split('.B').map(Number);
  positions[id] = center(a, b);
}

execFileSync('convert', [SCAN, '-resize', `${BACKGROUND_WIDTH}x`, '-quality', '85', BACKGROUND]);

const svgWidth = WIDTH * SCALE, svgHeight = HEIGHT * SCALE;
const r = DX * SCALE / 1.5, h = DY * SCALE / 2;
const f = (n: number) => +n.toFixed(2);
const hexPath = `M${f(r)} 0L${f(r / 2)} ${f(h)}L${f(-r / 2)} ${f(h)}L${f(-r)} 0L${f(-r / 2)} ${f(-h)}L${f(r / 2)} ${f(-h)}Z`;
const uses = board.map(id => {
  const {x, y} = positions[id];
  return `  <use id="${id}" transform="translate(${f(x * SCALE)} ${f(y * SCALE)})" xlink:href="#hexTemplate"/>`;
});
writeFileSync(MAP_SVG, `<svg id="map" version="1.1" viewBox="0 0 ${f(svgWidth)} ${f(svgHeight)}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
 <!-- Generated by tools/generate-map.ts -->
 <g id="mapbg">
  <image x="0" y="0" width="${f(svgWidth)}" height="${f(svgHeight)}" preserveAspectRatio="none" xlink:href="file://${resolve(ROOT, 'public/images/mapa.jpg')}"/>
 </g>
 <g id="hexes">
  <path id="hexTemplate" d="${hexPath}" fill-opacity="0" stroke="none"/>
${uses.join('\n')}
 </g>
 <g id="markers"/>
 <g id="units">
  <image id="plane-placeholder" x="0" y="0" width="20.204" height="20.204" preserveAspectRatio="none" xlink:href="file://${resolve(ROOT, 'public/planes/A6M.jpg')}"/>
 </g>
</svg>
`);

const list = (ids: string[]) => ids.map(it => `'${it}'`).join(', ').replace(/((?:'[^']+', ){8})/g, '$1\n  ');
writeFileSync(TERRAIN, `// Generated by tools/generate-map.ts from the colours of resources/mapa.png.

// 5.0.2: hexes all in a cloud.
export const CLOUD_HEXES: string[] = [
  ${list(clouds)},
]

// 5.0.2: hexes with a cloud and another kind of terrain.
export const CLOUD_EDGE_HEXES: string[] = [
  ${list(cloudEdges)},
]

// 6.1.2: land AA guns stand on these hexes only.
export const LAND_HEXES: string[] = [
  ${list(land)},
]
`);

console.log(`${board.length} hexes: ${clouds.length} cloud, ${cloudEdges.length} cloud edge, ${land.length} land; svg ${f(svgWidth)}x${f(svgHeight)}`);
