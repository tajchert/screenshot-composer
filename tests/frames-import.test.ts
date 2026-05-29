import { describe, it, expect } from 'vitest';
import { skinToId, skinDisplayName, buildFrameManifest } from '../src/frames/_build/frame-import.js';

describe('frame-import helpers', () => {
  it('maps skin ids to frame ids', () => {
    expect(skinToId('pixel_9')).toBe('pixel-9');
    expect(skinToId('pixel_9_pro_xl')).toBe('pixel-9-pro-xl');
    expect(skinToId('pixel_tablet')).toBe('pixel-tablet');
  });

  it('derives display names (Pro/XL casing)', () => {
    expect(skinDisplayName('pixel_9')).toBe('Pixel 9');
    expect(skinDisplayName('pixel_9_pro_xl')).toBe('Pixel 9 Pro XL');
    expect(skinDisplayName('pixel_9a')).toBe('Pixel 9a');
    expect(skinDisplayName('pixel_tablet')).toBe('Pixel Tablet');
  });

  it('builds a manifest from parsed geometry, applying the radius fallback', () => {
    const geo = { display: { width: 1080, height: 2400 }, cornerRadius: null,
                  frame: { width: 1200, height: 2541 }, offset: { x: 59, y: 58 } };
    const m = buildFrameManifest('pixel_7', geo);
    expect(m).toEqual({
      id: 'pixel-7', displayName: 'Pixel 7', manufacturer: 'Google',
      intrinsic: { width: 1200, height: 2541 },
      screen: { x: 59, y: 58, width: 1080, height: 2400, radius: Math.round(0.08 * 1080) },
      image: 'back.webp', mask: 'mask.webp',
      source: 'AOSP emulator skin pixel_7', license: 'Apache-2.0',
    });
  });

  it('uses the layout corner radius when present', () => {
    const geo = { display: { width: 1080, height: 2424 }, cornerRadius: 87,
                  frame: { width: 1198, height: 2531 }, offset: { x: 55, y: 58 } };
    expect(buildFrameManifest('pixel_9', geo).screen.radius).toBe(87);
  });
});
