import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFrames, loadManifest } from '../src/frames/load.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/frames');

describe('every frame on disk is structurally valid', () => {
  it('discovers at least one frame', async () => {
    const ids = await listFrames();
    expect(ids.length).toBeGreaterThan(0);
  });

  it('each frame: manifest validates, files match colors, SVGs match intrinsic and have no rasters/remote refs', async () => {
    const ids = await listFrames();
    for (const id of ids) {
      const manifest = await loadManifest(id);

      // colors and files agree
      expect(Object.keys(manifest.files).sort()).toEqual([...manifest.colors].sort());

      // screen rect inside intrinsic (also enforced by schema; assert here for a clear failure)
      expect(manifest.screen.x + manifest.screen.width).toBeLessThanOrEqual(manifest.intrinsic.width);
      expect(manifest.screen.y + manifest.screen.height).toBeLessThanOrEqual(manifest.intrinsic.height);

      // every declared SVG file exists, has a matching viewBox, no rasters, no remote refs
      for (const color of manifest.colors) {
        const svgPath = path.join(FRAMES_DIR, id, manifest.files[color]);
        const svg = await fs.readFile(svgPath, 'utf8');
        const expectedViewBox = `viewBox="0 0 ${manifest.intrinsic.width} ${manifest.intrinsic.height}"`;
        expect(svg, `${id}/${color}.svg viewBox`).toContain(expectedViewBox);
        expect(svg, `${id}/${color}.svg must contain <svg`).toMatch(/<svg[\s>]/);
        expect(svg, `${id}/${color}.svg must not contain <image elements`).not.toMatch(/<image[\s>]/);
        expect(svg, `${id}/${color}.svg must not load remote resources via href/src/xlink:href`)
          .not.toMatch(/(?:^|\s)(?:href|src|xlink:href)\s*=\s*["']https?:\/\//);
        expect(svg, `${id}/${color}.svg must not reference remote URLs in CSS url(...)`)
          .not.toMatch(/url\(\s*["']?https?:\/\//);
      }
    }
  });
});
