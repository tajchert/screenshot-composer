import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { resolveDimensions, enforceConstraints } from '../src/render/constraints.js';
import { ConstraintError } from '../src/errors.js';

describe('resolveDimensions', () => {
  it('returns 1080x1920 @1x for phone', () => {
    expect(resolveDimensions('phone')).toEqual({ width: 1080, height: 1920, scale: 1 });
  });
  it('throws for unsupported form factors in this milestone', () => {
    expect(() => resolveDimensions('tablet10')).toThrow(/not supported yet/);
  });
});

describe('enforceConstraints', () => {
  it('returns the PNG unchanged when already under 8 MB', async () => {
    const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } })
      .png().toBuffer();
    const out = await enforceConstraints(png, '01');
    expect(out).toBe(png);
  });

  it('downgrades to JPEG when the PNG exceeds 8 MB', async () => {
    // Random noise PNG that will not compress below 8 MB.
    const pixels = Buffer.alloc(4000 * 4000 * 3);
    for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 256);
    const png = await sharp(pixels, { raw: { width: 4000, height: 4000, channels: 3 } }).png().toBuffer();
    expect(png.byteLength).toBeGreaterThan(8 * 1024 * 1024);
    const out = await enforceConstraints(png, '01');
    expect(out.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
    // JPEG magic bytes
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
  });
});
