import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { listFrames, loadManifest } from '../src/frames/load.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/frames');

describe('every frame on disk is structurally valid (webp)', () => {
  it('discovers all 21 frames', async () => {
    expect((await listFrames()).length).toBeGreaterThanOrEqual(21);
  });

  it('each frame: manifest validates; back.webp ~= intrinsic; mask.webp present if declared', async () => {
    for (const id of await listFrames()) {
      const m = await loadManifest(id);
      expect(m.screen.x + m.screen.width).toBeLessThanOrEqual(m.intrinsic.width);
      expect(m.screen.y + m.screen.height).toBeLessThanOrEqual(m.intrinsic.height);

      const imgPath = path.join(FRAMES_DIR, id, m.image);
      expect(existsSync(imgPath), `${id}/${m.image}`).toBe(true);
      const meta = await sharp(imgPath).metadata();
      expect(meta.format, `${id} image format`).toBe('webp');
      // intrinsic is the layout canvas; the back.webp is scaled to fill it. Some skins export
      // a few border px extra, so the native size is within ~2% of intrinsic — assert closeness.
      expect(Math.abs(meta.width! - m.intrinsic.width) / m.intrinsic.width, `${id} width ~= intrinsic`).toBeLessThan(0.02);
      expect(Math.abs(meta.height! - m.intrinsic.height) / m.intrinsic.height, `${id} height ~= intrinsic`).toBeLessThan(0.02);

      if (m.mask) {
        const maskPath = path.join(FRAMES_DIR, id, m.mask);
        expect(existsSync(maskPath), `${id}/${m.mask}`).toBe(true);
        expect((await sharp(maskPath).metadata()).format).toBe('webp');
      }
    }
  });
});
