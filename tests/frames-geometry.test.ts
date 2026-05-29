import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, listFrames } from '../src/frames/load.js';
import { measureScreenCornerRadius } from '../src/frames/_build/frame-measure.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/frames');

const EXPECTED: Record<string, { intrinsic: [number, number]; screen: [number, number, number, number, number] }> = {
  'pixel-9':         { intrinsic: [1198, 2531], screen: [55, 58, 1080, 2424, 87] },
  'pixel-10-pro-xl': { intrinsic: [1466, 3101], screen: [60, 55, 1344, 2992, 108] },
  // Older skins omit corner_radius; radius is measured off the artwork (was a bad 0.08*width
  // guess of 205, which over-rounded the screenshot and leaked the background — see frame-measure).
  'pixel-tablet':    { intrinsic: [2798, 1837], screen: [119, 117, 2560, 1600, 26] },
};

describe('AOSP-derived frame geometry (representative)', () => {
  for (const [id, exp] of Object.entries(EXPECTED)) {
    it(`${id} matches the imported AOSP geometry`, async () => {
      const m = await loadManifest(id);
      expect([m.intrinsic.width, m.intrinsic.height]).toEqual(exp.intrinsic);
      expect([m.screen.x, m.screen.y, m.screen.width, m.screen.height, m.screen.radius]).toEqual(exp.screen);
      expect(m.license).toBe('Apache-2.0');
      expect(m.source).toMatch(/AOSP emulator skin/);
    });
  }
});

describe('every frame screen.radius matches its back.webp hole', () => {
  // Regression guard: the screenshot is rounded by screen.radius, so it MUST equal the
  // device's real display-corner radius baked into back.webp, or the rounded screenshot
  // curves inward past the hole and the page background leaks through the corner gap.
  // Only checks frames whose screen-rect corner sits inside the opaque body (measurable);
  // newer skins where the corner is outside the silhouette declare their own corner_radius.
  it('keeps screen.radius within 2px of the measured hole radius', async () => {
    const ids = await listFrames();
    expect(ids.length).toBeGreaterThan(0);
    const drift: string[] = [];
    for (const id of ids) {
      const m = await loadManifest(id);
      const measured = await measureScreenCornerRadius(path.join(FRAMES_DIR, id, 'back.webp'), m.screen);
      if (measured != null && Math.abs(measured - m.screen.radius) > 2) {
        drift.push(`${id}: manifest ${m.screen.radius} vs artwork ${measured}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
