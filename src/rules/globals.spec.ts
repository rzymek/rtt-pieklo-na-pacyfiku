import {readdirSync, readFileSync} from "node:fs";
import {join, relative} from "node:path";
import {expect, it} from "vitest";

// framework.js reads and sets G, L, R, V, P and ROLES at the top level of rules.js. A top-level declaration
// of the same name elsewhere makes the bundler rename the one from globals.ts, which then stays undefined.
const FRAMEWORK_NAMES = ["G", "L", "R", "V", "P", "ROLES"];

function sources(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return path.endsWith(".ts") && !path.endsWith(".spec.ts") ? [path] : [];
  });
}

it('declares the names the framework uses only in globals.ts', () => {
  const declaration = new RegExp(`^(?:export )?(?:const|let|var|function|class) (${FRAMEWORK_NAMES.join("|")})\\b`, "m");
  const clashes = sources(import.meta.dirname)
    .filter(path => !path.endsWith("globals.ts") && declaration.test(readFileSync(path, "utf8")))
    .map(path => relative(import.meta.dirname, path));
  expect(clashes).toEqual([]);
});
