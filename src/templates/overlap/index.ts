import type { TemplateProps, TemplateMeta, TemplateModule } from '../types.js';
import { escapeHtml, backgroundCss, computeDevice, deviceTransform, deviceMarkup, readyScript } from '../shared.js';

export const meta: TemplateMeta = {
  id: 'overlap',
  displayName: 'Floating Overlap',
  description: 'An oversized headline watermark behind a floating, shadowed device with accent blobs.',
  copyFields: [
    { key: 'headline', label: 'Headline', required: true },
    { key: 'subhead', label: 'Subhead', required: false },
  ],
};

export function render(props: TemplateProps): string {
  const { width, height, copy, screenshotUrl, frame, layout, theme } = props;
  const headline = copy.headline ?? '';
  const m = computeDevice(frame, Math.round(height * 0.66));
  const transform = deviceTransform(layout);

  const subhead = copy.subhead
    ? `<div class="subhead">${escapeHtml(copy.subhead)}</div>`
    : '';

  return `<!DOCTYPE html>
<html dir="ltr">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; }
  body {
    font-family: ${theme.fontFamily}, system-ui, sans-serif;
    background: ${backgroundCss(theme.background)};
    color: ${theme.palette.fg};
    overflow: hidden; position: relative;
  }
  .blob { position: absolute; border-radius: 50%; filter: blur(8px); opacity: 0.5; background: ${theme.palette.accent}; }
  .blob.a { width: 620px; height: 360px; top: 60px; left: -120px; }
  .blob.b { width: 480px; height: 480px; bottom: -120px; right: -100px; }
  .watermark {
    position: absolute; top: 12%; left: 0; right: 0; text-align: center;
    font-size: 280px; font-weight: 900; line-height: 1; letter-spacing: -0.02em;
    color: ${theme.palette.fg}; opacity: 0.12; white-space: nowrap; overflow: hidden;
  }
  .stage {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .device-wrap { filter: drop-shadow(0 40px 80px rgba(0,0,0,0.45)); }
  .subhead {
    position: absolute; bottom: 90px; left: 96px; right: 96px; text-align: center;
    font-size: 40px; font-weight: 600; color: ${theme.palette.fg};
  }
</style>
</head>
<body>
  <div class="blob a"></div>
  <div class="blob b"></div>
  <div class="watermark">${escapeHtml(headline)}</div>
  <div class="stage"><div class="device-wrap">${deviceMarkup(screenshotUrl, frame, m, transform)}</div></div>
  ${subhead}
  ${readyScript()}
</body>
</html>`;
}

const template: TemplateModule = { meta, render };
export default template;
