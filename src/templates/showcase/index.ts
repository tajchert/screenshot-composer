import type { TemplateProps, TemplateMeta, TemplateModule } from '../types.js';
import { escapeHtml, backgroundCss, computeDevice, deviceTransform, deviceMarkup, readyScript } from '../shared.js';

export const meta: TemplateMeta = {
  id: 'showcase',
  displayName: 'Showcase',
  description: 'Eyebrow, headline and subhead stacked above a tilted device. Editorial; uses subtext.',
  copyFields: [
    { key: 'eyebrow', label: 'Eyebrow', required: false },
    { key: 'headline', label: 'Headline', required: true },
    { key: 'subhead', label: 'Subhead', required: false },
  ],
};

export function render(props: TemplateProps): string {
  const { width, height, copy, screenshotUrl, frame, layout, theme } = props;
  const m = computeDevice(frame, Math.round(height * 0.6));
  const transform = deviceTransform(layout);

  const eyebrow = copy.eyebrow
    ? `<div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>`
    : '';
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
  .copy { position: absolute; top: 110px; left: 96px; right: 96px; }
  .eyebrow {
    font-size: 30px; letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 700; color: ${theme.palette.accent}; margin-bottom: 18px;
  }
  .headline { font-size: 84px; font-weight: 800; line-height: 1.04; }
  .subhead { font-size: 38px; font-weight: 500; line-height: 1.3; margin-top: 24px; color: ${theme.palette.muted}; }
  .stage {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${Math.round(height * 0.6)}px;
    display: flex; align-items: flex-end; justify-content: center;
  }
</style>
</head>
<body>
  <div class="copy">
    ${eyebrow}
    <div class="headline">${escapeHtml(copy.headline ?? '')}</div>
    ${subhead}
  </div>
  <div class="stage">${deviceMarkup(screenshotUrl, frame, m, transform)}</div>
  ${readyScript()}
</body>
</html>`;
}

const template: TemplateModule = { meta, render };
export default template;
