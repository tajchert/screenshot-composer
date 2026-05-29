import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  backgroundCss,
  computeDevice,
  deviceTransform,
  deviceMarkup,
  readyScript,
} from '../src/templates/shared.js';
import type { TemplateProps } from '../src/templates/types.js';

const frame: TemplateProps['frame'] = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  image: 'data:image/webp;base64,AAAA',
  mask: 'data:image/webp;base64,BBBB',
};

describe('shared template helpers', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<b> & "x"')).toBe('&lt;b&gt; &amp; &quot;x&quot;');
  });

  it('builds gradient and solid backgrounds', () => {
    expect(backgroundCss({ type: 'gradient', direction: 135, stops: ['#000', '#fff'] }))
      .toBe('linear-gradient(135deg, #000, #fff)');
    expect(backgroundCss({ type: 'solid', color: '#123456' })).toBe('#123456');
  });

  it('computes device metrics from intrinsic size + screen rect', () => {
    const m = computeDevice(frame, 1000);
    expect(m.deviceHeight).toBe(1000);
    expect(m.deviceWidth).toBe(Math.round((1000 * 800) / 1700));
    expect(m.screenLeft).toBeCloseTo((28 / 800) * 100);
    expect(m.screenW).toBeCloseTo((744 / 800) * 100);
  });

  it('builds the CSS transform from layout', () => {
    const t = deviceTransform({ tilt: { x: 4, y: -18, z: 0 }, translate: { x: 0, y: 40 }, perspective: 2000 });
    expect(t).toContain('perspective(2000px)');
    expect(t).toContain('rotateX(4deg)');
    expect(t).toContain('rotateY(-18deg)');
    expect(t).toContain('translate(0px, 40px)');
  });

  it('emits device markup: screenshot img, frame image overlay, mask overlay (no inline svg)', () => {
    const m = computeDevice(frame, 1000);
    const html = deviceMarkup('/input/en-US/phone/a.png', frame, m, 'none');
    expect(html).toContain('/input/en-US/phone/a.png');       // screenshot
    expect(html).toContain('data:image/webp;base64,AAAA');     // frame back.webp
    expect(html).toContain('data:image/webp;base64,BBBB');     // mask overlay
    expect(html).toContain('object-fit:cover');
    expect(html).toContain('border-radius:');
    expect(html).not.toContain('<svg');
  });

  it('omits the mask overlay when the frame has no mask', () => {
    const m = computeDevice(frame, 1000);
    const noMask = { ...frame, mask: undefined };
    const html = deviceMarkup('/input/a.png', noMask, m, 'none');
    expect(html).toContain('data:image/webp;base64,AAAA');
    expect(html).not.toContain('data:image/webp;base64,BBBB');
  });

  it('emits a readiness script setting __READY__', () => {
    expect(readyScript()).toContain('__READY__');
    expect(readyScript()).toContain('document.fonts.ready');
  });
});
