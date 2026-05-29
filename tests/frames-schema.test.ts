import { describe, it, expect } from 'vitest';
import { FrameManifestSchema } from '../src/frames/schema.js';

const valid = {
  id: 'pixel-9',
  displayName: 'Pixel 9',
  manufacturer: 'Google',
  intrinsic: { width: 1198, height: 2531 },
  screen: { x: 55, y: 58, width: 1080, height: 2424, radius: 87 },
  image: 'back.webp',
  mask: 'mask.webp',
  source: 'AOSP emulator skin pixel_9',
  license: 'Apache-2.0',
};

describe('FrameManifestSchema', () => {
  it('accepts a well-formed webp manifest', () => {
    expect(FrameManifestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires image', () => {
    const { image: _i, ...noImage } = valid;
    expect(FrameManifestSchema.safeParse(noImage).success).toBe(false);
  });

  it('makes mask optional', () => {
    const { mask: _m, ...noMask } = valid;
    expect(FrameManifestSchema.safeParse(noMask).success).toBe(true);
  });

  it('rejects a screen rect exceeding intrinsic bounds', () => {
    const bad = { ...valid, screen: { ...valid.screen, x: 200, width: 1198 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join(' ')).toMatch(/screen/);
  });

  it('rejects a screen rect exceeding intrinsic height', () => {
    const bad = { ...valid, screen: { ...valid.screen, y: 200, height: 2531 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join(' ')).toMatch(/height/);
  });

  it('rejects non-positive intrinsic dimensions', () => {
    expect(FrameManifestSchema.safeParse({ ...valid, intrinsic: { width: 0, height: 10 } }).success).toBe(false);
  });
});
