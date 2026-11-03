import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {defineRttModule} from '@rzymek/rally-the-troops-module/vite';

const moduleMame = 'pieklo-na-pacyfiku';
// The module is built into $RTT_DIR/public/$moduleName, RTT_DIR being the rally-the-troops server.
function outDir(): string {
  // Tests load this config too, but never build, so they need no RTT_DIR.
  if (process.env.VITEST) return 'unused-by-tests';
  const rttDir = process.env.RTT_DIR;
  if (!rttDir) throw new Error('Set RTT_DIR to the rally-the-troops server directory.');
  const publicDir = join(rttDir, 'public');
  if (!existsSync(publicDir)) throw new Error(`RTT_DIR=${rttDir} has no public directory.`);
  return join(publicDir, moduleMame);
}

export default defineRttModule({
  outDir: outDir(),
})
