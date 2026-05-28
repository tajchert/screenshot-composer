import { describe, it, expect } from 'vitest';
import { FrameManifestSchema } from '../src/frames/schema.js';

const valid = {
  id: 'pixel-9',
  displayName: 'Pixel 9',
  manufacturer: 'Google',
  colors: ['obsidian'],
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  shadow: { x: 0, y: 24, blur: 64, color: 'rgba(0,0,0,0.18)' },
  files: { obsidian: 'obsidian.svg' },
};

describe('FrameManifestSchema', () => {
  it('accepts a well-formed manifest', () => {
    const r = FrameManifestSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('rejects a manifest whose screen rect exceeds intrinsic bounds', () => {
    const bad = { ...valid, screen: { ...valid.screen, x: 100, width: 800 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message).join(' | ');
      expect(msgs).toMatch(/screen/);
    }
  });

  it('rejects a manifest whose colors[] has no matching files entry', () => {
    const bad = { ...valid, colors: ['obsidian', 'porcelain'] };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.')).join(' | ');
      expect(paths).toMatch(/files\.porcelain/);
    }
  });

  it('rejects a manifest with non-positive intrinsic dimensions', () => {
    const bad = { ...valid, intrinsic: { width: 0, height: 1700 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it('makes shadow optional', () => {
    const { shadow: _shadow, ...noShadow } = valid;
    const r = FrameManifestSchema.safeParse(noShadow);
    expect(r.success).toBe(true);
  });

  it('accepts optional source and license provenance fields', () => {
    const withProvenance = { ...valid, source: 'AOSP emulator skin pixel_9', license: 'Apache-2.0' };
    const r = FrameManifestSchema.safeParse(withProvenance);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe('AOSP emulator skin pixel_9');
      expect(r.data.license).toBe('Apache-2.0');
    }
  });

  it('still accepts a manifest with no provenance fields (back-compat)', () => {
    const r = FrameManifestSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
});
