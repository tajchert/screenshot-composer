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
  svg: '<svg viewBox="0 0 800 1700"></svg>',
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

  it('emits device markup containing the screenshot and frame svg', () => {
    const m = computeDevice(frame, 1000);
    const html = deviceMarkup('/input/en-US/phone/a.png', frame, m, 'none');
    expect(html).toContain('/input/en-US/phone/a.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
  });

  it('forces the frame svg to fill the device container, overriding its intrinsic size', () => {
    // A frame whose intrinsic px size (800x1700) differs from the device container
    // must still scale to the container, or the cutout drifts away from the screenshot.
    const sized: TemplateProps['frame'] = {
      ...frame,
      svg: '<svg viewBox="0 0 800 1700" width="800" height="1700"></svg>',
    };
    const m = computeDevice(sized, 1000); // deviceWidth ~= 471, not 800
    const html = deviceMarkup('/input/a.png', sized, m, 'none');
    // Inline style on the <svg> overrides the width/height presentation attributes,
    // so the viewBox maps to the (smaller) container the screenshot is sized against.
    expect(html).toMatch(/<svg[^>]*style="[^"]*width:\s*100%[^"]*height:\s*100%/);
  });

  it('emits a readiness script setting __READY__', () => {
    expect(readyScript()).toContain('__READY__');
    expect(readyScript()).toContain('document.fonts.ready');
  });
});
