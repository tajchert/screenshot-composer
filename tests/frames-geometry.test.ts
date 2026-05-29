import { describe, it, expect } from 'vitest';
import { loadManifest } from '../src/frames/load.js';

const EXPECTED: Record<string, { intrinsic: [number, number]; screen: [number, number, number, number, number] }> = {
  'pixel-9':         { intrinsic: [1198, 2531], screen: [55, 58, 1080, 2424, 87] },
  'pixel-10-pro-xl': { intrinsic: [1466, 3101], screen: [60, 55, 1344, 2992, 108] },
  'pixel-tablet':    { intrinsic: [2798, 1837], screen: [119, 117, 2560, 1600, 205] },
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
