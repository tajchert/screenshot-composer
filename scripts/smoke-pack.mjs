// Packaged smoke test: prove the *published* artifact works, not just the source tree.
//
// Packs the package, installs the tarball into a throwaway temp project, and exercises the
// installed binary end-to-end EXCEPT actual rendering (Chromium download is skipped to keep
// this fast — we are testing packaging, not the renderer):
//   • `--version`        → bin wiring + shebang
//   • `frames list`      → the .webp/manifest assets shipped in dist/ and resolve
//   • `init`             → scaffolding works from the installed package
//   • `doctor`           → loads the scaffolded config, proving the bare specifier
//                          `import 'screenshot-composer'` resolves from node_modules
//
// Run with: npm run smoke

import { execaSync } from 'execa';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, opts = {}) =>
  execaSync(cmd, args, { cwd: root, stdio: 'pipe', ...opts });

let tmp;
try {
  // 1. Build + pack.
  run('npm', ['run', 'build'], { stdio: 'inherit' });
  const packed = run('npm', ['pack', '--silent']);
  const tarball = path.join(root, packed.stdout.trim().split('\n').pop().trim());
  console.error(`packed: ${path.basename(tarball)}`);

  // 2. Fresh temp project, install the tarball (skip the Playwright browser download).
  tmp = mkdtempSync(path.join(os.tmpdir(), 'sc-smoke-'));
  const env = { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' };
  run('npm', ['init', '-y'], { cwd: tmp });
  console.error('installing tarball into temp project…');
  run('npm', ['install', tarball], { cwd: tmp, env, stdio: 'inherit' });

  const bin = path.join(tmp, 'node_modules', '.bin', 'screenshot-composer');

  // 3. Exercise the installed binary.
  const version = run(bin, ['--version'], { cwd: tmp, env }).stdout;
  if (!/screenshot-composer\s+\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`unexpected --version output:\n${version}`);
  }
  console.error(`✓ --version: ${version.split('\n')[0]}`);

  const frames = run(bin, ['frames', 'list'], { cwd: tmp, env }).stdout;
  if (!frames.includes('pixel-9')) throw new Error(`frames list missing pixel-9:\n${frames}`);
  console.error(`✓ frames list: ${frames.trim().split('\n').length} frames (assets shipped)`);

  run(bin, ['init'], { cwd: tmp, env });
  const scaffolded = readdirSync(path.join(tmp, 'play-screenshots'));
  if (!scaffolded.includes('screenshot-composer.config.ts')) {
    throw new Error(`init did not scaffold a config: ${scaffolded.join(', ')}`);
  }
  console.error('✓ init scaffolded play-screenshots/');

  // doctor loads the scaffolded config, which imports the bare 'screenshot-composer'
  // specifier — this proves it resolves from node_modules in a real install.
  const doctor = run(bin, ['doctor'], { cwd: tmp, env, reject: false });
  if (!/config/i.test(doctor.stdout)) {
    throw new Error(`doctor did not report a config check:\n${doctor.stdout}\n${doctor.stderr}`);
  }
  if (/Could not load|Invalid config/i.test(doctor.stdout + doctor.stderr)) {
    throw new Error(`config failed to load in installed package:\n${doctor.stdout}\n${doctor.stderr}`);
  }
  console.error('✓ doctor loaded the config (bare specifier resolves from node_modules)');

  console.error('\nSMOKE OK — packaged artifact is installable and runnable.');
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}
