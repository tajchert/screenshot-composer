import { describe, it, expect } from 'vitest';
import boldHeadline, { meta, render } from '../src/templates/bold-headline/index.js';
import type { TemplateProps } from '../src/templates/types.js';

const props: TemplateProps = {
  width: 1080,
  height: 1920,
  copy: { headline: 'Order in seconds' },
  screenshotUrl: '/input/en-US/phone/onboarding.png',
  frame: {
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    image: 'data:image/webp;base64,AAAA',
  },
  layout: { tilt: { x: 4, y: -18, z: 0 }, translate: { x: 0, y: 40 }, perspective: 2000 },
  theme: {
    fontFamily: 'system-ui',
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
};

describe('bold-headline template', () => {
  it('declares meta with a required headline field', () => {
    expect(meta.id).toBe('bold-headline');
    expect(boldHeadline.meta.id).toBe('bold-headline');
    expect(meta.copyFields.find((f) => f.key === 'headline')?.required).toBe(true);
  });

  it('embeds the headline, screenshot, frame image and readiness signal', () => {
    const html = render(props);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Order in seconds');
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('data:image/webp;base64,AAAA');
    expect(html).toContain('__READY__');
    expect(html).toContain('width: 1080px');
    expect(html).toContain('height: 1920px');
  });

  it('applies the tilt transform from layout', () => {
    const html = render(props);
    expect(html).toContain('rotateX(4deg)');
    expect(html).toContain('rotateY(-18deg)');
    expect(html).toContain('perspective(2000px)');
  });

  it('uses theme.palette.fg for the headline color (not hardcoded white)', () => {
    const html = render({
      ...props,
      theme: { ...props.theme, palette: { ...props.theme.palette, fg: '#abcdef' } },
    });
    expect(html).toMatch(/\.headline\s*{[^}]*color:\s*#abcdef/);
    expect(html).not.toMatch(/\.headline\s*{[^}]*color:\s*#ffffff/i);
  });

  it('escapes special characters in the headline', () => {
    const html = render({ ...props, copy: { headline: '<b>Fast</b> & "cheap"' } });
    expect(html).toContain('&lt;b&gt;Fast&lt;/b&gt; &amp; &quot;cheap&quot;');
    expect(html).not.toContain('<b>Fast</b>');
  });
});
