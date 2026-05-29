import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { parseAospLayout } from './aosp-layout.js';
import { buildFrameManifest, skinToId } from './frame-import.js';

const SDK = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk');
const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const skins = process.argv.slice(2);
if (skins.length === 0) {
  console.error('Usage: npm run frames:import -- pixel_9 pixel_8 ...');
  process.exit(1);
}

for (const skin of skins) {
  const skinDir = path.join(SDK, 'skins', skin);
  const geo = parseAospLayout(readFileSync(path.join(skinDir, 'layout'), 'utf8'));
  const manifest = buildFrameManifest(skin, geo);
  const outDir = path.join(FRAMES_DIR, skinToId(skin));
  mkdirSync(outDir, { recursive: true });
  copyFileSync(path.join(skinDir, 'back.webp'), path.join(outDir, 'back.webp'));
  copyFileSync(path.join(skinDir, 'mask.webp'), path.join(outDir, 'mask.webp'));
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.error(`✓ ${manifest.id}  (${manifest.intrinsic.width}x${manifest.intrinsic.height})`);
}
console.error(`Imported ${skins.length} frame(s) from ${SDK}`);
