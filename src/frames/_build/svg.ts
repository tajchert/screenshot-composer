import type { FrameManifest } from '../schema.js';

export interface PhoneSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  body: { top: string; bottom: string };
  bezelInner: string;
  button: string;
  camera: string;
}

export interface TabletSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  body: { top: string; bottom: string };
  bezelInner: string;
  camera: string;
}

/** Phone-style SVG: rounded bezel, screen cut out via mask, two side buttons on the right, a small punch-hole front camera near the top centre. */
export function buildPhoneSvg(opts: PhoneSvgOpts): string {
  const { intrinsic: i, screen: s, body, bezelInner, button, camera } = opts;
  const W = i.width;
  const H = i.height;
  const outerR = Math.round(Math.min(W, H) * 0.09);
  const btnX = W - 8;
  const btnW = 10;
  const pwrY = Math.round(H * 0.21);
  const pwrH = Math.round(H * 0.09);
  const volY = Math.round(H * 0.33);
  const volH = Math.round(H * 0.05);
  const camR = Math.max(8, Math.round(W * 0.014));
  const camCx = Math.round(W / 2);
  const camCy = Math.max(camR + 4, Math.round(s.y * 0.55));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${body.top}"/>
      <stop offset="1" stop-color="${body.bottom}"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="#000"/>
    </mask>
  </defs>
  <rect x="${btnX}" y="${pwrY}" width="${btnW}" height="${pwrH}" rx="5" fill="${button}"/>
  <rect x="${btnX}" y="${volY}" width="${btnW}" height="${volH}" rx="5" fill="${button}"/>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="url(#body)" mask="url(#screenHole)"/>
  <rect x="${s.x - 4}" y="${s.y - 4}" width="${s.width + 8}" height="${s.height + 8}" rx="${s.radius + 4}" ry="${s.radius + 4}" fill="none" stroke="${bezelInner}" stroke-width="6"/>
  <circle cx="${camCx}" cy="${camCy}" r="${camR}" fill="${camera}"/>
</svg>
`;
}

/** Tablet-style SVG: gentler corner radius, no side buttons, pill-shaped front camera centred above the screen. */
export function buildTabletSvg(opts: TabletSvgOpts): string {
  const { intrinsic: i, screen: s, body, bezelInner, camera } = opts;
  const W = i.width;
  const H = i.height;
  const outerR = Math.round(Math.min(W, H) * 0.045);
  const pillW = Math.round(W * 0.06);
  const pillH = Math.max(6, Math.round(W * 0.008));
  const pillX = Math.round((W - pillW) / 2);
  const pillY = Math.max(pillH, Math.round(s.y * 0.5) - Math.round(pillH / 2));
  const pillR = pillH / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${body.top}"/>
      <stop offset="1" stop-color="${body.bottom}"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="#000"/>
    </mask>
  </defs>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="url(#body)" mask="url(#screenHole)"/>
  <rect x="${s.x - 4}" y="${s.y - 4}" width="${s.width + 8}" height="${s.height + 8}" rx="${s.radius + 4}" ry="${s.radius + 4}" fill="none" stroke="${bezelInner}" stroke-width="6"/>
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillR}" ry="${pillR}" fill="${camera}"/>
</svg>
`;
}
