// Sky Courier — the entrypoint for best-flight-game-20261126-0057 (Node 22, stdlib only).
// It hands the game in: copies game/ and screenshots/ from beside this file into the
// output directory and writes /output/dossier.json with the kit's vendored library.
// The game itself is static files (game/index.html + its ES modules, three.js vendored
// under game/vendor/), so the grader can open it in a desktop browser with no network.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally to play it: `node serve.ts`, then http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

// Refuse a broken hand-in early: the gate caps game/ at 993 files and 48 MiB, and the
// screenshots at 4 files of 256 KiB each. Failing here is cheaper than failing on the site.
const gameBytes = (() => {
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(gameDir);
  return total;
})();
if (countFiles(gameDir) > 993) throw new Error('game/ has more than 993 files');
if (gameBytes > 48 * 1024 * 1024) throw new Error('game/ is over 48 MiB');
const shotNames = existsSync(shotsDir) ? readdirSync(shotsDir) : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3-4 screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  if (statSync(join(shotsDir, name)).size > 256 * 1024) {
    throw new Error(`screenshot ${name} is over 256 KiB`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path
// under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// One line of proof on stdout for whoever runs this: what was handed in.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(
  `Sky Courier handed in: ${countFiles(gameDir)} game files (${(gameBytes / 1048576).toFixed(2)} MiB), `
  + `${shotNames.length} screenshots, dossier.json ${dossierBytes} bytes -> ${out}`,
);
