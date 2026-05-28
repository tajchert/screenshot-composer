import type { FrameManifest } from '../schema.js';

export interface PhoneSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  metal: { top: string; bottom: string };
  rim: string;
  bezel: string;
  button: string;
  camera: string;
}

export interface TabletSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  metal: { top: string; bottom: string };
  rim: string;
  bezel: string;
  camera: string;
}

/** Fraction of the (minimum) bezel that the visible metal rim occupies; the rest is black bezel. */
const RIM_RATIO = 0.35;

function layers(i: FrameManifest['intrinsic'], s: FrameManifest['screen']) {
  const W = i.width;
  const H = i.height;
  const minBezel = Math.min(s.x, s.y, W - s.x - s.width, H - s.y - s.height);
  const outerR = s.radius + minBezel;
  const rimWidth = Math.round(RIM_RATIO * minBezel);
  const blackR = s.radius + (minBezel - rimWidth);
  return { W, H, outerR, rimWidth, blackR };
}

function defs(W: number, H: number, s: FrameManifest['screen'], metal: { top: string; bottom: string }): string {
  return `  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${metal.top}"/>
      <stop offset="1" stop-color="${metal.bottom}"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="#000"/>
    </mask>
  </defs>`;
}

/** Metal frame, a thin rim highlight on the outer edge, then a black bezel margin down to the screen. */
function frameLayers(W: number, H: number, outerR: number, rimWidth: number, blackR: number, rim: string, bezel: string): string {
  return `  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="url(#metal)" mask="url(#screenHole)"/>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="none" stroke="${rim}" stroke-width="3"/>
  <rect x="${rimWidth}" y="${rimWidth}" width="${W - 2 * rimWidth}" height="${H - 2 * rimWidth}" rx="${blackR}" ry="${blackR}" fill="${bezel}" mask="url(#screenHole)"/>`;
}

/** Phone-style SVG: metal frame + black bezel, two right-side buttons, a punch-hole front camera. */
export function buildPhoneSvg(opts: PhoneSvgOpts): string {
  const { intrinsic: i, screen: s, metal, rim, bezel, button, camera } = opts;
  const { W, H, outerR, rimWidth, blackR } = layers(i, s);
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
${defs(W, H, s, metal)}
${frameLayers(W, H, outerR, rimWidth, blackR, rim, bezel)}
  <circle cx="${camCx}" cy="${camCy}" r="${camR}" fill="${camera}"/>
  <rect x="${btnX}" y="${pwrY}" width="${btnW}" height="${pwrH}" rx="5" fill="${button}"/>
  <rect x="${btnX}" y="${volY}" width="${btnW}" height="${volH}" rx="5" fill="${button}"/>
</svg>
`;
}

/** Tablet-style SVG: metal frame + black bezel, no side buttons, pill front camera centred above the screen. */
export function buildTabletSvg(opts: TabletSvgOpts): string {
  const { intrinsic: i, screen: s, metal, rim, bezel, camera } = opts;
  const { W, H, outerR, rimWidth, blackR } = layers(i, s);
  const pillW = Math.round(W * 0.06);
  const pillH = Math.max(6, Math.round(W * 0.008));
  const pillX = Math.round((W - pillW) / 2);
  const pillY = Math.max(pillH, Math.round(s.y * 0.5) - Math.round(pillH / 2));
  const pillR = pillH / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${defs(W, H, s, metal)}
${frameLayers(W, H, outerR, rimWidth, blackR, rim, bezel)}
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillR}" ry="${pillR}" fill="${camera}"/>
</svg>
`;
}
