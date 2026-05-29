import type { TemplateProps } from './types.js';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function backgroundCss(bg: TemplateProps['theme']['background']): string {
  if (bg.type === 'gradient' && bg.stops && bg.stops.length >= 2) {
    return `linear-gradient(${bg.direction ?? 135}deg, ${bg.stops.join(', ')})`;
  }
  return bg.color ?? '#111827';
}

export interface DeviceMetrics {
  deviceWidth: number;
  deviceHeight: number;
  screenLeft: number;
  screenTop: number;
  screenW: number;
  screenH: number;
  screenRadius: number;
}

export function computeDevice(frame: TemplateProps['frame'], deviceHeight: number): DeviceMetrics {
  const { intrinsic, screen } = frame;
  const deviceWidth = Math.round((deviceHeight * intrinsic.width) / intrinsic.height);
  return {
    deviceWidth,
    deviceHeight,
    screenLeft: (screen.x / intrinsic.width) * 100,
    screenTop: (screen.y / intrinsic.height) * 100,
    screenW: (screen.width / intrinsic.width) * 100,
    screenH: (screen.height / intrinsic.height) * 100,
    screenRadius: (screen.radius / intrinsic.width) * deviceWidth,
  };
}

export function deviceTransform(layout: TemplateProps['layout']): string {
  const { tilt, translate, perspective } = layout;
  return `perspective(${perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(${tilt.z}deg) translate(${translate.x}px, ${translate.y}px)`;
}

export function deviceMarkup(
  screenshotUrl: string,
  frame: TemplateProps['frame'],
  m: DeviceMetrics,
  transform: string,
): string {
  // Layers (bottom→top): screenshot (clipped to the screen rect with the device corner
  // radius), the frame back.webp (transparent screen hole), then — when present — the
  // mask.webp overlaid at the screen rect. The mask is transparent over the display and
  // opaque-black only in the corner wedges, so it clips the screenshot corners to the
  // device's exact (non-circular) display shape, which border-radius alone can't match.
  const maskImg = frame.mask
    ? `<img style="position:absolute;left:${m.screenLeft}%;top:${m.screenTop}%;width:${m.screenW}%;height:${m.screenH}%;pointer-events:none;" src="${frame.mask}" alt="">`
    : '';
  return `<div style="position:relative;width:${m.deviceWidth}px;height:${m.deviceHeight}px;transform:${transform};transform-origin:center center;">
      <img style="position:absolute;left:${m.screenLeft}%;top:${m.screenTop}%;width:${m.screenW}%;height:${m.screenH}%;object-fit:cover;border-radius:${m.screenRadius}px;" src="${escapeHtml(screenshotUrl)}" alt="">
      <img style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" src="${frame.image}" alt="">
      ${maskImg}
    </div>`;
}

export function readyScript(): string {
  return `<script>(async()=>{await document.fonts.ready;const imgs=Array.from(document.images).filter((i)=>!i.complete);await Promise.all(imgs.map((i)=>new Promise((r)=>{i.onload=i.onerror=r;})));window.__READY__=true;})();</script>`;
}
