// Capacitor CLI 8.x has no way to point a `cap` command at a non-default
// config file (`--config` / CAPACITOR_CONFIG are both ignored). This wrapper
// temporarily swaps capacitor.stocking.config.ts in as capacitor.config.ts,
// runs `npx cap <args>`, then always restores the original — so the standalone
// stocking APK can be scaffolded / synced without disturbing the main app's
// capacitor.config.ts or ./android project.
//
//   node scripts/with-stocking-capacitor.mjs add android
//   node scripts/with-stocking-capacitor.mjs sync android

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';

const MAIN = 'capacitor.config.ts';
const BACKUP = 'capacitor.config.main.ts';
const STOCKING = 'capacitor.stocking.config.ts';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: node scripts/with-stocking-capacitor.mjs <cap args…>');
  process.exit(1);
}

if (existsSync(BACKUP)) {
  console.error(
    `${BACKUP} already exists — a previous run left the swap half-done.\n` +
      `Check it against ${MAIN}, restore by hand, then retry.`,
  );
  process.exit(1);
}

renameSync(MAIN, BACKUP);
copyFileSync(STOCKING, MAIN);

let code = 0;
try {
  execSync(`npx cap ${args.join(' ')}`, { stdio: 'inherit' });
} catch (err) {
  code = typeof err?.status === 'number' ? err.status : 1;
} finally {
  rmSync(MAIN, { force: true });
  renameSync(BACKUP, MAIN);
}

process.exit(code);
