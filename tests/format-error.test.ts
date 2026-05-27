import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/schema.js';
import { formatZodError } from '../src/config/format-error.js';

function errorFor(obj: unknown) {
  const r = ConfigSchema.safeParse(obj);
  if (r.success) throw new Error('expected parse to fail');
  return r.error;
}

describe('formatZodError', () => {
  it('renders the file header and one bullet per issue with dotted+indexed paths', () => {
    const err = errorFor({
      locales: ['en-US'],
      defaultLocale: 'en-US',
      formFactors: ['phone'],
      theme: {
        palette: { fg: '#000', accent: '#111', muted: '#222' },
        background: { type: 'gradient', stops: ['#000', '#111'] },
      },
      slots: [
        {
          id: '01',
          template: 'bold-headline',
          screenshot: 'a.png',
          frame: { id: 'pixel-9' },
          layout: { tilt: { x: 0, y: -75, z: 0 } },
          copy: { headline: { 'en-US': 'x' } },
        },
      ],
    });
    const out = formatZodError('cfg.ts', err);
    expect(out).toContain('cfg.ts');
    expect(out).toContain('slots[0].layout.tilt.y');
    // each issue is a bullet line
    expect(out.split('\n').filter((l) => l.trim().startsWith('•')).length).toBeGreaterThanOrEqual(1);
  });

  it('labels root-level issues as (root)', () => {
    const err = errorFor('not an object');
    const out = formatZodError('cfg.ts', err);
    expect(out).toContain('(root)');
  });
});
