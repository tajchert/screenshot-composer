import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseAospLayout } from './aosp-layout.js';

const SDK = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk');
const skins = process.argv.slice(2);
if (skins.length === 0) {
  console.error('Usage: npm run frames:extract -- pixel_9 pixel_8 ...');
  process.exit(1);
}

for (const skin of skins) {
  const layoutPath = path.join(SDK, 'skins', skin, 'layout');
  const g = parseAospLayout(readFileSync(layoutPath, 'utf8'));
  const radius = g.cornerRadius ?? Math.round(0.08 * g.display.width); // heuristic: ~8% of display width when the AOSP skin omits corner_radius (Pixel 6/7/8)
  const screen = { x: g.offset.x, y: g.offset.y, width: g.display.width, height: g.display.height, radius };
  console.log(`// source: AOSP emulator skin ${skin}`);
  console.log(`intrinsic: { width: ${g.frame.width}, height: ${g.frame.height} },`);
  console.log(`screen: ${JSON.stringify(screen)},`);
  console.log('');
}
