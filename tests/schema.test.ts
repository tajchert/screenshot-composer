import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/schema.js';

const valid = {
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: { headline: { 'en-US': 'Order in seconds' } },
    },
  ],
};

describe('ConfigSchema', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const parsed = ConfigSchema.parse(valid);
    expect(parsed.paths.inputs).toBe('./inputs');
    expect(parsed.slots[0].layout.tilt).toEqual({ x: 0, y: 0, z: 0 });
    expect(parsed.slots[0].layout.perspective).toBe(2000);
    expect(parsed.theme.fontFamily).toBe('system-ui');
  });

  it('rejects tilt outside [-45, 45]', () => {
    const bad = structuredClone(valid);
    (bad.slots[0] as any).layout = { tilt: { x: 0, y: -75, z: 0 } };
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path.join('.')).toContain('slots.0.layout.tilt.y');
    }
  });

  it('rejects more than 8 slots', () => {
    const bad = structuredClone(valid);
    bad.slots = Array.from({ length: 9 }, (_, i) => ({ ...valid.slots[0], id: `s${i}` }));
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a gradient background with fewer than 2 stops', () => {
    const bad = structuredClone(valid);
    bad.theme.background = { type: 'gradient', stops: ['#000'] } as any;
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
  });

  it('rejects a solid background with no color', () => {
    const bad = structuredClone(valid);
    bad.theme.background = { type: 'solid' } as any;
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a solid background with a color', () => {
    const ok = structuredClone(valid);
    ok.theme.background = { type: 'solid', color: '#101828' } as any;
    expect(ConfigSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects an invalid CSS color in the palette', () => {
    const bad = structuredClone(valid);
    bad.theme.palette.fg = 'not a color!!';
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an empty rgb() color', () => {
    const bad = structuredClone(valid);
    bad.theme.palette.fg = 'rgb()';
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects defaultLocale that is not in locales', () => {
    const bad = structuredClone(valid);
    bad.defaultLocale = 'fr';
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'defaultLocale')).toBe(true);
    }
  });

  it('accepts a per-form-factor orientation override on a slot', () => {
    const cfg = structuredClone(valid);
    (cfg.slots[0] as any).orientation = { tablet10: 'portrait' };
    const res = ConfigSchema.safeParse(cfg);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.slots[0].orientation).toEqual({ tablet10: 'portrait' });
    }
  });

  it('rejects an invalid orientation value', () => {
    const bad = structuredClone(valid);
    (bad.slots[0] as any).orientation = { phone: 'sideways' };
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path.join('.')).toContain('slots.0.orientation.phone');
    }
  });
});
