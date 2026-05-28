import { describe, it, expect } from 'vitest';
import { loadManifest } from '../src/frames/load.js';

// Exact AOSP-derived geometry (committed into generate.ts). Guards against drift.
const EXPECTED: Record<string, { intrinsic: [number, number]; screen: [number, number, number, number, number] }> = {
  'pixel-9':        { intrinsic: [1198, 2531], screen: [55, 58, 1080, 2424, 87] },
  'pixel-9-pro':    { intrinsic: [1408, 2974], screen: [60, 61, 1280, 2856, 109] },
  'pixel-9-pro-xl': { intrinsic: [1466, 3101], screen: [57, 56, 1344, 2992, 108] },
  'pixel-9a':       { intrinsic: [1224, 2570], screen: [69, 73, 1080, 2424, 87] },
  'pixel-8':        { intrinsic: [1187, 2513], screen: [49, 55, 1080, 2400, 86] },
  'pixel-8-pro':    { intrinsic: [1469, 3104], screen: [58, 58, 1344, 2992, 108] },
  'pixel-7':        { intrinsic: [1200, 2541], screen: [59, 58, 1080, 2400, 86] },
  'pixel-7-pro':    { intrinsic: [1547, 3272], screen: [48, 66, 1440, 3120, 115] },
  'pixel-6':        { intrinsic: [1209, 2553], screen: [60, 69, 1080, 2400, 86] },
  'pixel-6-pro':    { intrinsic: [1527, 3289], screen: [41, 72, 1440, 3120, 115] },
  'pixel-tablet':   { intrinsic: [1837, 2798], screen: [117, 119, 1600, 2560, 48] },
};

describe('AOSP-derived frame geometry', () => {
  for (const [id, exp] of Object.entries(EXPECTED)) {
    it(`${id} matches the committed AOSP geometry`, async () => {
      const m = await loadManifest(id);
      expect([m.intrinsic.width, m.intrinsic.height]).toEqual(exp.intrinsic);
      expect([m.screen.x, m.screen.y, m.screen.width, m.screen.height, m.screen.radius]).toEqual(exp.screen);
      expect(m.license).toBe('Apache-2.0');
      expect(m.source).toMatch(/AOSP emulator skin/);
    });
  }
});
