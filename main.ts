// Vice Lights Studio — gta6-cover-art-01 entry program (Node 22, stdlib only).
//
// The app is plain static files in app/ beside this file: a desktop browser
// serves them offline (app/index.html plus its ES modules and two sample
// photos, no network request anywhere). This program hands the entry in: it
// copies app/ and screenshots/ into the output directory and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output directory so a stale run never leaks into the entry.
mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'app'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
rmSync(join(outDir, 'dossier.json'), { force: true });

cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's own caps (from the kit's reference/gate.json): only
// text_max_bytes shapes the dossier's bytes; the rest refuse an entry the
// scorer would refuse anyway (more than 4 screenshots, one over 256 KiB,
// app/ over 993 files or 48 MiB, a path under app/ over 1000 bytes).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
