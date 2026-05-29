import { describe, it, expect } from 'vitest';
import type { Slot } from '../src/config/schema.js';
import { resolveOrientation, resolveRenderTarget, DEFAULT_ORIENTATION } from '../src/render/target.js';

// Minimal Slot stub; only fields the target helper reads matter.
function slot(orientation?: Slot['orientation']): Slot {
  return {
    id: 's',
    template: 'bold-headline',
    screenshot: 'x.png',
    frame: { id: 'pixel-9' },
    layout: { tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
    orientation,
    copy: {},
  } as Slot;
}

describe('DEFAULT_ORIENTATION', () => {
  it('phone is portrait, tablets are landscape', () => {
    expect(DEFAULT_ORIENTATION).toEqual({ phone: 'portrait', tablet7: 'landscape', tablet10: 'landscape' });
  });
});

describe('resolveOrientation', () => {
  it('falls back to the per-form-factor default when unset', () => {
    expect(resolveOrientation(slot(), 'phone')).toBe('portrait');
    expect(resolveOrientation(slot(), 'tablet10')).toBe('landscape');
  });
  it('honors a per-form-factor override', () => {
    expect(resolveOrientation(slot({ tablet10: 'portrait' }), 'tablet10')).toBe('portrait');
    // An override for one factor does not affect others.
    expect(resolveOrientation(slot({ tablet10: 'portrait' }), 'phone')).toBe('portrait');
    expect(resolveOrientation(slot({ phone: 'landscape' }), 'phone')).toBe('landscape');
  });
});

describe('resolveRenderTarget', () => {
  it('tablet10 default = landscape 1920x1080 @2x', () => {
    expect(resolveRenderTarget(slot(), 'tablet10')).toEqual({
      width: 1920, height: 1080, scale: 2, orientation: 'landscape',
    });
  });
  it('tablet7 portrait override = 1200x1920 @1x', () => {
    expect(resolveRenderTarget(slot({ tablet7: 'portrait' }), 'tablet7')).toEqual({
      width: 1200, height: 1920, scale: 1, orientation: 'portrait',
    });
  });
  it('phone default = portrait 1080x1920 @1x', () => {
    expect(resolveRenderTarget(slot(), 'phone')).toEqual({
      width: 1080, height: 1920, scale: 1, orientation: 'portrait',
    });
  });
});
