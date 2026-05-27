export interface TemplateProps {
  width: number;
  height: number;
  headline: string;
  screenshotUrl: string;
  frame: {
    intrinsic: { width: number; height: number };
    screen: { x: number; y: number; width: number; height: number; radius: number };
    svg: string;
  };
  layout: {
    tilt: { x: number; y: number; z: number };
    translate: { x: number; y: number };
    perspective: number;
  };
  theme: {
    fontFamily: string;
    palette: { fg: string; accent: string; muted: string };
    background: { type: 'solid' | 'gradient'; color?: string; direction?: number; stops?: string[] };
  };
}

function backgroundCss(bg: TemplateProps['theme']['background']): string {
  if (bg.type === 'gradient' && bg.stops && bg.stops.length >= 2) {
    return `linear-gradient(${bg.direction ?? 135}deg, ${bg.stops.join(', ')})`;
  }
  return bg.color ?? '#111827';
}

export function renderHtml(props: TemplateProps): string {
  const { width, height, headline, screenshotUrl, frame, layout, theme } = props;
  const { intrinsic, screen } = frame;

  // Device occupies ~72% of canvas height; width derived from frame aspect.
  const deviceHeight = Math.round(height * 0.72);
  const deviceWidth = Math.round((deviceHeight * intrinsic.width) / intrinsic.height);

  // Screenshot placement as percentages of the device box (from the manifest).
  const screenLeft = (screen.x / intrinsic.width) * 100;
  const screenTop = (screen.y / intrinsic.height) * 100;
  const screenW = (screen.width / intrinsic.width) * 100;
  const screenH = (screen.height / intrinsic.height) * 100;
  const screenRadius = (screen.radius / intrinsic.width) * deviceWidth;

  const transform = `perspective(${layout.perspective}px) rotateX(${layout.tilt.x}deg) rotateY(${layout.tilt.y}deg) rotateZ(${layout.tilt.z}deg) translate(${layout.translate.x}px, ${layout.translate.y}px)`;

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
    overflow: hidden;
    position: relative;
  }
  .headline {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 96px 80px 0;
    text-align: center;
    font-size: 76px; font-weight: 800; line-height: 1.05;
    color: #ffffff;
  }
  .stage {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${Math.round(height * 0.74)}px;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .device {
    position: relative;
    width: ${deviceWidth}px; height: ${deviceHeight}px;
    transform: ${transform};
    transform-origin: center center;
  }
  .device .screen {
    position: absolute;
    left: ${screenLeft}%; top: ${screenTop}%;
    width: ${screenW}%; height: ${screenH}%;
    object-fit: cover;
    border-radius: ${screenRadius}px;
  }
  .device .frame {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none;
  }
</style>
</head>
<body>
  <div class="headline">${escapeHtml(headline)}</div>
  <div class="stage">
    <div class="device">
      <img class="screen" src="${screenshotUrl}" alt="">
      <div class="frame">${frame.svg}</div>
    </div>
  </div>
  <script>
    (async () => {
      await document.fonts.ready;
      const imgs = Array.from(document.images).filter((i) => !i.complete);
      await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
      window.__READY__ = true;
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
