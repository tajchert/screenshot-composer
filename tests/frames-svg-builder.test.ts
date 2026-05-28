import { describe, it, expect } from 'vitest';
import { buildPhoneSvg, buildTabletSvg } from '../src/frames/_build/svg.js';

const phone = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  metal: { top: '#3a3a3f', bottom: '#0e0e10' },
  rim: '#6b6b70',
  bezel: '#050506',
  button: '#1a1a1c',
  camera: '#070708',
};

const tablet = {
  intrinsic: { width: 1000, height: 1600 },
  screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
  metal: { top: '#5b5f65', bottom: '#23262a' },
  rim: '#8b8f95',
  bezel: '#050506',
  camera: '#070708',
};

// Concentric geometry for the phone fixture:
//   minBezel = min(28,30, 800-28-744=28, 1700-30-1640=30) = 28
//   metal outer radius = 44 + 28 = 72  (rect uses rx = outerR-2 = 70)
//   rimWidth = round(0.35*28) = 10
//   black bezel outer radius = 44 + (28-10) = 62 ; inset rect at x=10 y=10 w=780 h=1680
describe('buildPhoneSvg (layered metal/bezel)', () => {
  it('emits a clean SVG with the right viewBox and metal gradient', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1700"');
    expect(svg).toContain('id="metal"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).toContain('#3a3a3f');
    expect(svg).toContain('#0e0e10');
    expect(svg).not.toMatch(/<image[\s>]/);
    expect(svg).not.toMatch(/(?:^|\s)(?:href|src|xlink:href)\s*=\s*["']https?:\/\//);
  });

  it('places the screen mask using the manifest screen rect', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('x="28" y="30" width="744" height="1640" rx="44" ry="44"');
  });

  it('draws three concentric layers: metal body, rim highlight, black bezel margin', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('fill="url(#metal)"');
    expect(svg).toContain(`stroke="${phone.rim}"`);
    expect(svg).toContain(`fill="${phone.bezel}"`);
    expect(svg).toContain('rx="70" ry="70"');
    expect(svg).toContain('x="10" y="10" width="780" height="1680" rx="62" ry="62"');
  });

  it('draws side buttons AFTER the metal body (so they appear on top)', () => {
    const svg = buildPhoneSvg(phone);
    const bodyIdx = svg.indexOf('fill="url(#metal)"');
    const buttonIdx = svg.indexOf(`fill="${phone.button}"`);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(buttonIdx).toBeGreaterThan(bodyIdx);
  });

  it('has the front camera as a circle', () => {
    expect(buildPhoneSvg(phone)).toContain('<circle');
  });
});

describe('buildTabletSvg (layered metal/bezel)', () => {
  it('emits a clean SVG with viewBox, metal gradient, bezel and a pill camera (no buttons/circle)', () => {
    const svg = buildTabletSvg(tablet);
    expect(svg).toContain('viewBox="0 0 1000 1600"');
    expect(svg).toContain('id="metal"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).toContain('fill="url(#metal)"');
    expect(svg).toContain(`fill="${tablet.bezel}"`);
    expect(svg).not.toContain('<circle');
    expect(svg).not.toMatch(/<image[\s>]/);
  });
});
