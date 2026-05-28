import { describe, it, expect } from 'vitest';
import showcase from '../../src/templates/showcase/index.js';
import type { TemplateProps } from '../../src/templates/types.js';

const baseProps: Omit<TemplateProps, 'copy'> = {
  width: 1080,
  height: 1920,
  screenshotUrl: '/input/en-US/phone/onboarding.png',
  frame: {
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    svg: '<svg viewBox="0 0 800 1700"></svg>',
  },
  layout: { tilt: { x: 0, y: -8, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
  theme: {
    fontFamily: 'Inter',
    palette: { fg: '#FFFFFF', accent: '#818CF8', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 160, stops: ['#0F172A', '#1E293B'] },
  },
};

describe('showcase template', () => {
  const props: TemplateProps = {
    ...baseProps,
    copy: { eyebrow: 'Fast & simple', headline: 'Everything in one tap', subhead: 'Reorder favourites instantly.' },
  };

  it('declares meta: headline required, eyebrow + subhead optional', () => {
    expect(showcase.meta.id).toBe('showcase');
    const f = (k: string) => showcase.meta.copyFields.find((x) => x.key === k);
    expect(f('headline')?.required).toBe(true);
    expect(f('eyebrow')?.required).toBe(false);
    expect(f('subhead')?.required).toBe(false);
  });

  it('renders all copy fields, the screenshot, frame and readiness signal', () => {
    const html = showcase.render(props);
    expect(html).toContain('Fast &amp; simple');
    expect(html).toContain('Everything in one tap');
    expect(html).toContain('Reorder favourites instantly.');
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
    expect(html).toContain('__READY__');
    expect(html).toContain('width: 1080px');
  });

  it('omits optional copy markup when absent and never emits remote URLs', () => {
    const html = showcase.render({ ...baseProps, copy: { headline: 'Only headline' } });
    expect(html).toContain('Only headline');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
