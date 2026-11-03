// Cuts the plane counters out of resources/counters.pdf into public/planes/<type>.jpg (front) and <type>_.jpg (reverse).
// The counter number is painted over: the game tells the planes apart on its own.
// Run: node tools/extract-counters.ts   (needs poppler's `pdfimages` and ImageMagick's `convert`)
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PDF = resolve(ROOT, 'resources/counters.pdf');
const OUT = resolve(ROOT, 'public/planes');

// 300 dpi sheets: counters of 185 px, every 200 px. Each reverse sheet follows its front one, mirrored left to right.
const PITCH = 200, SIZE = 185, COLUMNS = 10;
const SHEETS = {front1: 'c-000.png', back1: 'c-002.png', front2: 'c-004.png', back2: 'c-006.png'};
// The header area with the counter number.
const NUMBER = {x1: 145, y1: 4, x2: 181, y2: 35};
const OUTPUT_SIZE = 120;

// The counter number 1 of each type, as [sheet, row, column].
const COUNTERS: Record<string, [1 | 2, number, number]> = {
  F4F: [1, 0, 0], P39: [1, 0, 8], F6F: [1, 1, 0], F4U: [1, 2, 0], SBD: [1, 3, 0], SB2C: [1, 4, 0],
  TBD: [1, 5, 0], TBF: [1, 6, 0], B25: [1, 7, 0], B17: [1, 8, 0],
  A6M: [1, 10, 0], D3A: [1, 11, 0], G4M: [1, 12, 0], B6N: [1, 14, 0],
  P1Y: [2, 0, 0], D4Y: [2, 1, 0], B5N: [2, 2, 0], A6M6: [2, 3, 2],
};

const dir = mkdtempSync(join(tmpdir(), 'counters-'));
try {
  execFileSync('pdfimages', ['-png', '-f', '1', '-l', '4', PDF, join(dir, 'c')]);
  const cut = (sheet: string, row: number, column: number, out: string) => {
    const src = join(dir, sheet), x = column * PITCH, y = row * PITCH;
    const header = execFileSync('convert', [src, '-format', `%[pixel:p{${x + 165},${y + 5}}]`, 'info:']).toString();
    execFileSync('convert', [
      src, '-crop', `${SIZE}x${SIZE}+${x}+${y}`, '+repage',
      '-fill', header, '-draw', `rectangle ${NUMBER.x1},${NUMBER.y1} ${NUMBER.x2},${NUMBER.y2}`,
      '-resize', `${OUTPUT_SIZE}x${OUTPUT_SIZE}`, '-quality', '90', out,
    ]);
  };
  for (const [type, [sheet, row, column]] of Object.entries(COUNTERS)) {
    const [front, back] = sheet === 1 ? [SHEETS.front1, SHEETS.back1] : [SHEETS.front2, SHEETS.back2];
    cut(front, row, column, join(OUT, `${type}.jpg`));
    cut(back, row, COLUMNS - 1 - column, join(OUT, `${type}_.jpg`));
  }
  console.log(`${Object.keys(COUNTERS).length} plane types`);
} finally {
  rmSync(dir, {recursive: true});
}
