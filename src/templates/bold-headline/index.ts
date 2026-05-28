import type { TemplateProps, TemplateMeta, TemplateModule } from '../types.js';
import { escapeHtml, backgroundCss, computeDevice, deviceTransform, deviceMarkup, readyScript } from '../shared.js';

export const meta: TemplateMeta = {
  id: 'bold-headline',
  displayName: 'Bold Headline',
  description: 'A large centered headline up top with the device frame rising from the bottom.',
  copyFields: [{ key: 'headline', label: 'Headline', required: true }],
};

export function render(props: TemplateProps): string {
  const { width, height, copy, screenshotUrl, frame, layout, theme } = props;
  const headline = copy.headline ?? '';
  const m = computeDevice(frame, Math.round(height * 0.72));
  const transform = deviceTransform(layout);

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
  .headline {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 96px 80px 0; text-align: center;
    font-size: 76px; font-weight: 800; line-height: 1.05; color: ${theme.palette.fg};
  }
  .stage {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${Math.round(height * 0.74)}px;
    display: flex; align-items: flex-end; justify-content: center;
  }
</style>
</head>
<body>
  <div class="headline">${escapeHtml(headline)}</div>
  <div class="stage">${deviceMarkup(screenshotUrl, frame, m, transform)}</div>
  ${readyScript()}
</body>
</html>`;
}

const template: TemplateModule = { meta, render };
export default template;
