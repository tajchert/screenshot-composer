import { describe, it, expect } from 'vitest';
import { buildPhoneSvg, buildTabletSvg } from '../src/frames/_build/svg.js';

const phone = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  body: { top: '#2b2b2f', bottom: '#0e0e10' },
  bezelInner: '#000000',
  button: '#1a1a1c',
  camera: '#070708',
};

const tablet = {
  intrinsic: { width: 1000, height: 1600 },
  screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
  body: { top: '#4b4f55', bottom: '#2a2d31' },
  bezelInner: '#0c0c0c',
  camera: '#070708',
};

describe('buildPhoneSvg', () => {
  it('emits a valid SVG with the right viewBox, gradient, mask, buttons and camera', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1700"');
    expect(svg).toContain('id="body"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).toContain('#2b2b2f');
    expect(svg).toContain('#0e0e10');
    expect(svg).toContain('#1a1a1c'); // buttons
    expect(svg).toContain('<circle');  // front camera
    expect(svg).not.toMatch(/(?:^|\s)(?:href|src|xlink:href)\s*=\s*["']https?:\/\//);
    expect(svg).not.toMatch(/<image[\s>]/);
  });

  it('places the screen mask using the manifest screen rect', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('x="28" y="30" width="744" height="1640" rx="44" ry="44"');
  });

  it('draws side buttons AFTER the body rect (so they appear on top, not hidden behind it)', () => {
    const svg = buildPhoneSvg(phone);
    // Locate the body rect (matches: fill="url(#body)" mask="url(#screenHole)"), and the first button rect.
    const bodyIdx = svg.indexOf('fill="url(#body)"');
    const buttonIdx = svg.indexOf(`fill="${phone.button}"`);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(buttonIdx).toBeGreaterThan(-1);
    expect(buttonIdx, 'side buttons must be drawn after the body rect').toBeGreaterThan(bodyIdx);
  });
});

describe('buildTabletSvg', () => {
  it('emits a valid SVG with viewBox, mask, and a pill camera (no side buttons)', () => {
    const svg = buildTabletSvg(tablet);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 1000 1600"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).not.toContain('<circle'); // tablets use a pill, not a circle
    expect(svg).toMatch(/<rect[^>]*rx="\d+(?:\.\d+)?" ry="\d+(?:\.\d+)?"/); // at least one rounded rect (the pill / body)
    expect(svg).not.toMatch(/<image[\s>]/);
  });
});
