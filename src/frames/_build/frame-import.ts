import type { AospGeometry } from './aosp-layout.js';
import type { FrameManifest } from '../schema.js';

export function skinToId(skin: string): string {
  return skin.replaceAll('_', '-');
}

export function skinDisplayName(skin: string): string {
  return skin
    .split('_')
    .map((t) => (t === 'xl' ? 'XL' : t === 'pro' ? 'Pro' : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(' ');
}

/** Pure: build a manifest object from a skin id + parsed layout geometry. */
export function buildFrameManifest(skin: string, geo: AospGeometry): FrameManifest {
  const radius = geo.cornerRadius ?? Math.round(0.08 * geo.display.width);
  return {
    id: skinToId(skin),
    displayName: skinDisplayName(skin),
    manufacturer: 'Google',
    intrinsic: { width: geo.frame.width, height: geo.frame.height },
    screen: { x: geo.offset.x, y: geo.offset.y, width: geo.display.width, height: geo.display.height, radius },
    image: 'back.webp',
    mask: 'mask.webp',
    source: `AOSP emulator skin ${skin}`,
    license: 'Apache-2.0',
  };
}
