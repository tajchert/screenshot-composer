// Post-`tsc` build step. The TypeScript compiler emits only .js/.d.ts; it does not
// move the binary frame assets, and we want a guaranteed-executable CLI with a shebang.
//
// 1. Copy each src/frames/<id>/{manifest.json,*.webp} into dist/frames/<id>/. The frame
//    loader (src/frames/load.ts) reads these relative to its own compiled module
//    (FRAMES_DIR = dirname(import.meta.url)), so they must sit next to dist/frames/load.js.
// 2. Ensure dist/cli.js starts with a `#!/usr/bin/env node` shebang and is executable.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcFrames = path.join(root, 'src', 'frames');
const distFrames = path.join(root, 'dist', 'frames');
const cli = path.join(root, 'dist', 'cli.js');

const FRAME_ASSET = /\.(webp|json)$/i;

async function copyFrameAssets() {
  const entries = await fs.readdir(srcFrames, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_build') continue;
    const srcDir = path.join(srcFrames, entry.name);
    const manifest = path.join(srcDir, 'manifest.json');
    try {
      await fs.access(manifest);
    } catch {
      continue; // not a frame directory
    }
    const destDir = path.join(distFrames, entry.name);
    await fs.mkdir(destDir, { recursive: true });
    for (const file of await fs.readdir(srcDir)) {
      if (!FRAME_ASSET.test(file)) continue;
      await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
      copied++;
    }
  }
  return copied;
}

async function ensureCliShebang() {
  const SHEBANG = '#!/usr/bin/env node';
  let body = await fs.readFile(cli, 'utf8');
  if (!body.startsWith('#!')) {
    body = `${SHEBANG}\n${body}`;
    await fs.writeFile(cli, body, 'utf8');
  }
  await fs.chmod(cli, 0o755);
}

const copied = await copyFrameAssets();
await ensureCliShebang();
console.error(`build-finalize: copied ${copied} frame asset(s) into dist/frames, cli.js ready`);
